<?php

namespace Tests\Feature;

use App\Models\AdminTask;
use App\Models\AppNotification;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class AdvisorTasksTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // These API tests must never connect to an office or production database.
        // The full legacy migration history contains PostgreSQL-only CHECK SQL.
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        foreach ([
            '0001_01_01_000000_create_users_table.php',
            '2026_10_26_202948_create_projects_table.php',
            '2026_10_26_203036_create_permission_tables.php',
            '2026_10_26_210743_create_personal_access_tokens_table.php',
            '2026_10_27_033923_create_audit_logs_table.php',
            '2026_10_27_211500_create_project_user_table.php',
            '2026_10_27_212000_create_admin_tasks_table.php',
            '2026_10_27_232000_add_completed_at_to_admin_tasks_table.php',
            '2026_10_28_100000_add_phone_to_users_table.php',
            '2026_10_28_110000_create_app_notifications_table.php',
            '2026_11_18_000000_add_soft_deletes_and_status_to_users_table.php',
        ] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        foreach (['Super Admin', 'Administrador', 'Asesor Comercial', 'Topógrafo'] as $role) {
            Role::findOrCreate($role, 'web');
        }
        Cache::put('system_mora_count', 0, 600);
    }

    public function test_ceo_assigns_tasks_to_active_administrators_and_advisors_with_role_notifications(): void
    {
        $ceo = $this->user('Super Admin');
        $project = Project::create(['name' => 'Proyecto de prueba', 'location' => 'Oficina']);

        foreach (['Administrador', 'Asesor Comercial'] as $role) {
            $assignee = $this->user($role);
            $response = $this->asUser($ceo, 'POST', '/api/admin-tasks', [
                'title' => 'Trabajo de '.$role,
                'description' => 'Trabajo asignado por Gerencia',
                'assigned_to' => $assignee->id,
                'project_id' => $project->id,
                'priority' => 'Alta',
            ])->assertCreated();

            $taskId = $response->json('data.id');
            $this->assertDatabaseHas('admin_tasks', [
                'id' => $taskId, 'assigned_to' => $assignee->id,
                'assigned_by' => $ceo->id, 'status' => 'Pendiente',
            ]);
            $this->assertDatabaseHas('app_notifications', [
                'target_user_id' => $assignee->id, 'target_role' => $role,
                'type' => 'task_assigned', 'action_url' => '/tareas',
            ]);
            $response->assertJsonPath('data.assignee.name', $assignee->name)
                ->assertJsonPath('data.assignee_role', $role);
        }
    }

    public function test_ceo_cannot_assign_to_ceo_topographer_inactive_or_deleted_users(): void
    {
        $ceo = $this->user('Super Admin');
        $topographer = $this->user('Topógrafo');
        $inactive = $this->user('Asesor Comercial');
        $inactive->update(['is_active' => false]);
        $deleted = $this->user('Administrador');
        $deleted->delete();
        $anotherCeo = $this->user('Super Admin');
        $anotherCeo->assignRole(Role::findOrCreate('Administrador', 'web'));

        foreach ([$ceo, $anotherCeo, $topographer, $inactive, $deleted] as $invalidAssignee) {
            $this->asUser($ceo, 'POST', '/api/admin-tasks', [
                'title' => 'No debe crearse', 'assigned_to' => $invalidAssignee->id,
            ])->assertUnprocessable()->assertJsonValidationErrors('assigned_to');
        }
        $this->assertDatabaseCount('admin_tasks', 0);
        $this->assertDatabaseCount('app_notifications', 0);
    }

    public function test_only_ceo_can_create_tasks_and_topographers_cannot_open_the_task_api(): void
    {
        $this->user('Super Admin');
        $assignee = $this->user('Asesor Comercial');

        foreach (['Administrador', 'Asesor Comercial', 'Topógrafo'] as $role) {
            $staff = $this->user($role);
            $this->asUser($staff, 'POST', '/api/admin-tasks', [
                'title' => 'Intento sin permiso', 'assigned_to' => $assignee->id,
            ])->assertForbidden();
            if ($role === 'Topógrafo') {
                $this->asUser($staff, 'GET', '/api/admin-tasks')->assertForbidden();
            }
        }
        $this->assertDatabaseCount('admin_tasks', 0);
    }

    public function test_staff_listing_is_strictly_personal_even_with_spoofed_role_or_assignee_parameters(): void
    {
        $ceo = $this->user('Super Admin');
        $administrator = $this->user('Administrador');
        $advisor = $this->user('Asesor Comercial');
        $otherAdvisor = $this->user('Asesor Comercial');
        $adminTask = $this->task($ceo, $administrator);
        $advisorTask = $this->task($ceo, $advisor);
        $this->task($ceo, $otherAdvisor);

        foreach ([[$administrator, $adminTask], [$advisor, $advisorTask]] as [$staff, $ownTask]) {
            $this->assertTaskIds($this->asUser($staff, 'GET', '/api/admin-tasks'), [$ownTask->id]);
            $this->assertTaskIds($this->asUser($staff, 'GET', '/api/admin-tasks?'.http_build_query([
                'assigned_to' => $otherAdvisor->id, 'role' => 'Super Admin',
                'simulate_role' => 'CEO / Gerente', 'admin_id' => $otherAdvisor->id,
            ]), [], [
                'X-Admin-Id' => (string) $otherAdvisor->id,
                'X-Simulated-Role' => 'Super Admin',
            ]), [$ownTask->id]);
        }
    }

    public function test_staff_can_complete_only_own_tasks_and_cannot_reassign_or_edit_ceo_instructions(): void
    {
        $ceo = $this->user('Super Admin');
        $administrator = $this->user('Administrador');
        $advisor = $this->user('Asesor Comercial');
        $otherAdvisor = $this->user('Asesor Comercial');
        $otherTask = $this->task($ceo, $otherAdvisor);

        foreach ([$administrator, $advisor] as $staff) {
            $own = $this->task($ceo, $staff, ['priority' => 'Baja']);
            $this->asUser($staff, 'PUT', '/api/admin-tasks/'.$otherTask->id, ['status' => 'Completada'])
                ->assertForbidden();
            $this->asUser($staff, 'PUT', '/api/admin-tasks/'.$own->id, [
                'status' => 'Completada', 'assigned_to' => $otherAdvisor->id,
                'title' => 'No autorizado', 'priority' => 'Alta',
            ])->assertOk();
            $finished = $own->fresh();
            $this->assertSame($staff->id, $finished->assigned_to);
            $this->assertSame($own->title, $finished->title);
            $this->assertSame('Baja', $finished->priority);
            $this->assertSame('Completada', $finished->status);
            $this->assertNotNull($finished->completed_at);
        }
        $this->assertSame('Pendiente', $otherTask->fresh()->status);
        $this->assertSame(2, AppNotification::where('type', 'task_completed')->where('target_role', 'Super Admin')->count());

        $this->asUser($ceo, 'PUT', '/api/admin-tasks/'.$otherTask->id, ['status' => 'Completada'])
            ->assertUnprocessable();
        $this->asUser($advisor, 'DELETE', '/api/admin-tasks/'.$otherTask->id)->assertForbidden();
        $this->asUser($advisor, 'DELETE', '/api/admin-tasks/completed/clear')->assertForbidden();
    }

    public function test_ceo_filters_role_responsible_priority_project_and_pending_completed_status(): void
    {
        $ceo = $this->user('Super Admin');
        $administrator = $this->user('Administrador');
        $advisor = $this->user('Asesor Comercial');
        $first = Project::create(['name' => 'Primer proyecto', 'location' => 'A']);
        $second = Project::create(['name' => 'Segundo proyecto', 'location' => 'B']);
        $adminPending = $this->task($ceo, $administrator, ['priority' => 'Alta', 'project_id' => $first->id]);
        $adminDone = $this->task($ceo, $administrator, ['priority' => 'Baja', 'project_id' => $second->id, 'status' => 'Completada']);
        $advisorProgress = $this->task($ceo, $advisor, ['priority' => 'Alta', 'project_id' => $second->id, 'status' => 'En Curso']);
        $advisorDone = $this->task($ceo, $advisor, ['priority' => 'Media', 'project_id' => $first->id, 'status' => 'Completada']);

        foreach ([
            [['role' => 'Administrador'], [$adminPending->id, $adminDone->id]],
            [['role' => 'Asesor Comercial'], [$advisorProgress->id, $advisorDone->id]],
            [['assigned_to' => $advisor->id], [$advisorProgress->id, $advisorDone->id]],
            [['priority' => 'Alta'], [$adminPending->id, $advisorProgress->id]],
            [['project_id' => $first->id], [$adminPending->id, $advisorDone->id]],
            [['status' => 'pending'], [$adminPending->id, $advisorProgress->id]],
            [['status' => 'completed'], [$adminDone->id, $advisorDone->id]],
            [['role' => 'Asesor Comercial', 'priority' => 'Alta', 'project_id' => $second->id, 'status' => 'pending'], [$advisorProgress->id]],
        ] as [$filters, $ids]) {
            $this->assertTaskIds($this->asUser($ceo, 'GET', '/api/admin-tasks?'.http_build_query($filters)), $ids);
        }
    }

    public function test_notification_counts_and_read_operations_are_scoped_to_each_staff_member(): void
    {
        $ceo = $this->user('Super Admin');
        $administrator = $this->user('Administrador');
        $advisor = $this->user('Asesor Comercial');
        $otherAdvisor = $this->user('Asesor Comercial');
        $this->task($ceo, $administrator);
        $this->task($ceo, $advisor);
        $this->task($ceo, $advisor, ['status' => 'En Curso']);
        $this->task($ceo, $advisor, ['status' => 'Completada']);
        $this->task($ceo, $otherAdvisor);
        $ownNotice = $this->notice($advisor);
        $otherNotice = $this->notice($otherAdvisor);
        $adminNotice = $this->notice($administrator);

        foreach ([[$administrator, 1, $adminNotice], [$advisor, 2, $ownNotice], [$otherAdvisor, 1, $otherNotice]] as [$staff, $pending, $notice]) {
            $this->asUser($staff, 'GET', '/api/notifications/summary')->assertOk()
                ->assertJsonPath('pending_tasks_count', $pending)
                ->assertJsonCount(1, 'notifications')
                ->assertJsonPath('notifications.0.id', $notice->id);
        }
        $this->asUser($advisor, 'POST', '/api/notifications/'.$otherNotice->id.'/read')->assertNotFound();
        $this->assertFalse($otherNotice->fresh()->is_read);
        $this->asUser($advisor, 'POST', '/api/notifications/read-all')->assertOk();
        $this->assertTrue($ownNotice->fresh()->is_read);
        $this->assertFalse($otherNotice->fresh()->is_read);
        $this->assertFalse($adminNotice->fresh()->is_read);
    }

    public function test_ceo_reassignment_rejects_inactive_users_and_preserves_visibility_of_departed_assignees(): void
    {
        $ceo = $this->user('Super Admin');
        $administrator = $this->user('Administrador');
        $advisor = $this->user('Asesor Comercial');
        $task = $this->task($ceo, $administrator);
        $this->asUser($ceo, 'PUT', '/api/admin-tasks/'.$task->id, ['assigned_to' => $advisor->id])->assertOk();
        $this->assertSame($advisor->id, $task->fresh()->assigned_to);
        $administrator->update(['is_active' => false]);
        $this->asUser($ceo, 'PUT', '/api/admin-tasks/'.$task->id, ['assigned_to' => $administrator->id])->assertUnprocessable();

        $advisor->update(['is_active' => false]);
        $advisor->delete();
        $response = $this->asUser($ceo, 'GET', '/api/admin-tasks?'.http_build_query(['role' => 'Asesor Comercial']));
        $this->assertTaskIds($response, [$task->id]);
        $response->assertJsonPath('data.0.assignee.name', $advisor->name)
            ->assertJsonPath('data.0.assignee_role', 'Asesor Comercial');
    }

    private function user(string $role): User
    {
        config(['auth.defaults.guard' => 'web']);
        $user = User::factory()->create();
        $user->assignRole(Role::findOrCreate($role, 'web'));

        return $user;
    }

    private function task(User $ceo, User $assignee, array $attributes = []): AdminTask
    {
        return AdminTask::create(array_merge([
            'title' => 'Tarea de '.bin2hex(random_bytes(4)),
            'assigned_by' => $ceo->id, 'assigned_to' => $assignee->id,
            'priority' => 'Media', 'status' => 'Pendiente',
        ], $attributes));
    }

    private function notice(User $user): AppNotification
    {
        return AppNotification::create([
            'target_role' => $user->getRoleNames()->first(), 'target_user_id' => $user->id,
            'type' => 'task_assigned', 'title' => 'Nueva tarea', 'message' => 'Tarea privada', 'action_url' => '/tareas',
        ]);
    }

    private function asUser(User $user, string $method, string $uri, array $data = [], array $headers = []): TestResponse
    {
        // Authenticate each simulated request from its token, as a real browser would.
        Auth::forgetGuards();
        config(['auth.defaults.guard' => 'web']);
        $headers['Authorization'] = 'Bearer '.$user->createToken('task-test')->plainTextToken;

        return $this->json($method, $uri, $data, $headers);
    }

    private function assertTaskIds(TestResponse $response, array $expectedIds): void
    {
        $actualIds = $response->assertOk()->json('data.*.id');
        sort($actualIds);
        sort($expectedIds);
        $this->assertSame($expectedIds, $actualIds);
    }
}
