<?php

namespace Tests\Feature;

use App\Models\AdminTask;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\Deed;
use App\Models\Lead;
use App\Models\Lot;
use App\Models\Payment;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserHistoryPreservationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Run only the portable dependency migrations: the full history contains
        // PostgreSQL-specific CHECK SQL. Never run these tests on an external DB.
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        foreach ([
            '0001_01_01_000000_create_users_table.php',
            '2026_10_26_202948_create_projects_table.php',
            '2026_10_26_202949_create_customers_table.php',
            '2026_10_26_202949_create_lots_table.php',
            '2026_10_26_202950_create_payments_table.php',
            '2026_10_26_203036_create_permission_tables.php',
            '2026_10_26_210743_create_personal_access_tokens_table.php',
            '2026_10_26_235500_create_leads_table.php',
            '2026_10_27_033923_create_audit_logs_table.php',
            '2026_10_27_111000_add_void_status_to_payments_table.php',
            '2026_10_27_120500_add_user_id_to_leads_and_customers_table.php',
            '2026_10_27_210000_add_signature_base64_to_users_table.php',
            '2026_10_27_210500_add_user_id_to_payments_table.php',
            '2026_10_27_211500_create_project_user_table.php',
            '2026_10_27_212000_create_admin_tasks_table.php',
            '2026_10_27_212500_create_deeds_table.php',
            '2026_10_28_100000_add_phone_to_users_table.php',
            '2026_11_14_010000_add_password_reset_requests_to_users_table.php',
            '2026_11_18_000000_add_soft_deletes_and_status_to_users_table.php',
        ] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_deactivation_preserves_every_historical_row_and_original_user_relations(): void
    {
        $ceo = $this->user('Super Admin');
        $advisor = $this->user('Asesor Comercial');
        $history = $this->history($advisor);
        $snapshots = [];
        foreach ($history as $key => $record) {
            $snapshots[$key] = (array) DB::table($record->getTable())->find($record->id);
        }
        $advisor->createToken('existing-device');

        $this->asToken($ceo, 'DELETE', '/api/users/'.$advisor->id)->assertOk();

        $formerAdvisor = User::withTrashed()->findOrFail($advisor->id);
        $this->assertTrue($formerAdvisor->trashed());
        $this->assertFalse($formerAdvisor->is_active);
        $this->assertSame(0, $formerAdvisor->tokens()->count());
        foreach ($history as $key => $record) {
            $this->assertSame($snapshots[$key], (array) DB::table($record->getTable())->find($record->id), $key);
        }
        foreach ([
            $history['payment']->fresh()->cashier,
            $history['payment']->fresh()->voidedByUser,
            $history['customer']->fresh()->advisor,
            $history['lead']->fresh()->advisor,
            $history['audit']->fresh()->user,
            $history['task']->fresh()->assignedTo,
            $history['task']->fresh()->assignedBy,
            $history['deed']->fresh()->assignedAdmin,
        ] as $originalUser) {
            $this->assertNotNull($originalUser);
            $this->assertSame($advisor->id, $originalUser->id);
            $this->assertSame($advisor->name, $originalUser->name);
            $this->assertTrue($originalUser->trashed());
        }
        $this->assertDatabaseHas('project_user', ['project_id' => $history['project']->id, 'user_id' => $advisor->id]);
        $this->assertTrue(AuditLog::where('user_id', $ceo->id)->where('action', 'like', '%historial operativo%')->exists());
    }

    public function test_only_ceo_can_deactivate_and_super_admin_accounts_are_protected(): void
    {
        $ceo = $this->user('Super Admin');
        $otherCeo = $this->user('Super Admin');
        $administrator = $this->user('Administrador');
        $advisor = $this->user('Asesor Comercial');

        $this->asToken($administrator, 'DELETE', '/api/users/'.$advisor->id)->assertForbidden();
        $this->asToken($ceo, 'DELETE', '/api/users/'.$ceo->id)->assertUnprocessable();
        $this->asToken($ceo, 'DELETE', '/api/users/'.$otherCeo->id)->assertUnprocessable();

        foreach ([$ceo, $otherCeo, $advisor] as $user) {
            $this->assertFalse($user->fresh()->trashed());
            $this->assertTrue($user->fresh()->is_active);
        }
    }

    public function test_inactive_and_soft_deleted_accounts_cannot_log_in_or_request_a_password_reset(): void
    {
        $this->user('Super Admin');
        foreach ([false, true] as $softDeleted) {
            $advisor = $this->user('Asesor Comercial');
            $advisor->update(['is_active' => false]);
            if ($softDeleted) {
                $advisor->delete();
            }

            $this->request('POST', '/api/login', ['email' => $advisor->email, 'password' => 'password'])
                ->assertForbidden()->assertJsonPath('message', 'Esta cuenta ha sido desactivada por Gerencia.');
            $this->request('POST', '/api/forgot-password-request', ['email' => $advisor->email])
                ->assertForbidden();
            $this->assertSame(0, $advisor->tokens()->count());
            $this->assertFalse(User::withTrashed()->findOrFail($advisor->id)->password_reset_requested);
        }
    }

    public function test_existing_tokens_are_denied_when_inactive_and_revoked_when_deactivated(): void
    {
        $ceo = $this->user('Super Admin');
        $advisor = $this->user('Asesor Comercial');
        $token = $advisor->createToken('existing-device')->plainTextToken;

        $advisor->update(['is_active' => false]);
        $this->request('GET', '/api/user', [], $token)->assertForbidden();
        $advisor->update(['is_active' => true]);
        $this->request('GET', '/api/user', [], $token)->assertOk();
        $this->asToken($ceo, 'DELETE', '/api/users/'.$advisor->id)->assertOk();
        $this->request('GET', '/api/user', [], $token)->assertUnauthorized();
        $this->assertSame(0, $advisor->tokens()->count());
    }

    public function test_ceo_can_filter_inactive_users_and_reactivate_without_resurrecting_old_tokens(): void
    {
        $ceo = $this->user('Super Admin');
        $active = $this->user('Administrador');
        $inactive = $this->user('Asesor Comercial');
        $oldPassword = $inactive->password;
        $oldToken = $inactive->createToken('old-device')->plainTextToken;
        $history = $this->history($inactive);
        $this->asToken($ceo, 'DELETE', '/api/users/'.$inactive->id)->assertOk();

        $activeIds = $this->asToken($ceo, 'GET', '/api/users?status=active')->assertOk()->json('data.*.id');
        $this->assertContains($active->id, $activeIds);
        $this->assertNotContains($inactive->id, $activeIds);
        $this->asToken($ceo, 'GET', '/api/users?status=inactive')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $inactive->id)
            ->assertJsonPath('data.0.is_active', false);
        $this->asToken($ceo, 'GET', '/api/users?status=all')->assertOk()->assertJsonCount(3, 'data');
        $this->asToken($ceo, 'GET', '/api/users/options')->assertOk()->assertJsonMissing(['id' => $inactive->id]);

        $this->asToken($ceo, 'POST', '/api/users/'.$inactive->id.'/reactivate')->assertOk();
        $reactivated = User::findOrFail($inactive->id);
        $this->assertTrue($reactivated->is_active);
        $this->assertNull($reactivated->deleted_at);
        $this->assertSame($oldPassword, $reactivated->password);
        $this->assertSame($inactive->id, $history['payment']->fresh()->user_id);
        $this->request('GET', '/api/user', [], $oldToken)->assertUnauthorized();
        $this->request('POST', '/api/login', ['email' => $inactive->email, 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.id', $inactive->id)->assertJsonStructure(['token']);
    }

    public function test_portfolio_transfer_moves_assignments_but_preserves_receipt_emitters_and_closed_leads(): void
    {
        $ceo = $this->user('Super Admin');
        $source = $this->user('Asesor Comercial');
        $target = $this->user('Asesor Comercial');
        $history = $this->history($source);
        $closed = Lead::create(['name' => 'Venta finalizada', 'user_id' => $source->id, 'stage' => 'Cierre Ganado']);
        $discarded = Lead::create(['name' => 'Prospecto descartado', 'user_id' => $source->id, 'stage' => 'Descartado']);
        $this->asToken($ceo, 'DELETE', '/api/users/'.$source->id)->assertOk();

        $this->asToken($ceo, 'POST', '/api/users/'.$source->id.'/transfer-portfolio', ['target_user_id' => $target->id])
            ->assertOk()->assertJsonPath('customers_transferred', 1)->assertJsonPath('leads_transferred', 1);

        $this->assertSame($target->id, $history['customer']->fresh()->assigned_user_id);
        $this->assertSame($target->id, $history['lead']->fresh()->user_id);
        $this->assertSame($source->id, $history['payment']->fresh()->user_id);
        $this->assertSame($source->id, $history['audit']->fresh()->user_id);
        $this->assertSame($source->id, $closed->fresh()->user_id);
        $this->assertSame($source->id, $discarded->fresh()->user_id);
        $this->assertDatabaseHas('project_user', ['project_id' => $history['project']->id, 'user_id' => $target->id]);
        $this->assertDatabaseHas('project_user', ['project_id' => $history['project']->id, 'user_id' => $source->id]);
    }

    public function test_portfolio_transfer_requires_an_inactive_source_and_an_active_commercial_advisor(): void
    {
        $ceo = $this->user('Super Admin');
        $source = $this->user('Asesor Comercial');
        $target = $this->user('Asesor Comercial');
        $administrator = $this->user('Administrador');

        $this->asToken($ceo, 'POST', '/api/users/'.$source->id.'/transfer-portfolio', ['target_user_id' => $target->id])
            ->assertUnprocessable();
        $source->update(['is_active' => false]);
        $this->asToken($ceo, 'POST', '/api/users/'.$source->id.'/transfer-portfolio', ['target_user_id' => $administrator->id])
            ->assertUnprocessable();
        $target->update(['is_active' => false]);
        $this->asToken($ceo, 'POST', '/api/users/'.$source->id.'/transfer-portfolio', ['target_user_id' => $target->id])
            ->assertUnprocessable();
    }

    public function test_user_foreign_keys_never_cascade_and_accidental_hard_deletion_is_restricted(): void
    {
        $this->user('Super Admin');
        $advisor = $this->user('Asesor Comercial');
        $history = $this->history($advisor);
        foreach (['payments', 'customers', 'leads', 'deeds', 'audit_logs', 'admin_tasks', 'project_user'] as $table) {
            foreach (Schema::getForeignKeys($table) as $foreignKey) {
                if ($foreignKey['foreign_table'] === 'users') {
                    $this->assertNotSame('cascade', $foreignKey['on_delete'], $table);
                }
            }
        }

        try {
            $advisor->forceDelete();
            $this->fail('A referenced user must not be physically deleted.');
        } catch (QueryException) {
            $this->assertDatabaseHas('users', ['id' => $advisor->id]);
            $this->assertDatabaseHas('audit_logs', ['id' => $history['audit']->id, 'user_id' => $advisor->id]);
            $this->assertDatabaseHas('admin_tasks', ['id' => $history['task']->id, 'assigned_to' => $advisor->id]);
        }
    }

    private function user(string $role): User
    {
        config(['auth.defaults.guard' => 'web']);
        $user = User::factory()->create();
        $user->assignRole(Role::findOrCreate($role, 'web'));

        return $user;
    }

    private function history(User $user): array
    {
        $project = Project::create(['name' => 'Proyecto histórico', 'location' => 'Oficina']);
        $user->assignedProjects()->attach($project->id);
        $customer = Customer::create(['name' => 'Cliente histórico', 'email' => 'cliente-'.$user->id.'@example.test',
            'phone' => '0990000000', 'id_card' => 'TEST-'.$user->id, 'assigned_user_id' => $user->id]);
        $lot = Lot::create(['project_id' => $project->id, 'customer_id' => $customer->id,
            'lot_number' => 'Lote 1', 'area_m2' => 900, 'total_price' => 45000, 'status' => 'Vendido']);
        $payment = Payment::create(['lot_id' => $lot->id, 'user_id' => $user->id, 'voided_by' => $user->id,
            'amount_paid' => 1000, 'debt_balance' => 44000, 'payment_method' => 'Efectivo',
            'signature_base64' => 'firma-original', 'status' => 'Válido']);
        $lead = Lead::create(['name' => 'Prospecto histórico', 'project_id' => $project->id,
            'user_id' => $user->id, 'stage' => 'Nuevo Prospecto']);
        $audit = AuditLog::record($user->id, 'Pagos', 'Emitió recibo original');
        $task = AdminTask::create(['title' => 'Tarea histórica', 'assigned_to' => $user->id,
            'assigned_by' => $user->id, 'project_id' => $project->id]);
        $deed = Deed::create(['customer_id' => $customer->id, 'lot_id' => $lot->id,
            'project_id' => $project->id, 'assigned_admin_id' => $user->id]);

        return compact('project', 'customer', 'lot', 'payment', 'lead', 'audit', 'task', 'deed');
    }

    private function asToken(User $user, string $method, string $uri, array $data = []): TestResponse
    {
        return $this->request($method, $uri, $data, $user->createToken('test-request')->plainTextToken);
    }

    private function request(string $method, string $uri, array $data = [], ?string $token = null): TestResponse
    {
        // Each HTTP call must authenticate its Bearer token afresh, as a real client does.
        Auth::forgetGuards();
        config(['auth.defaults.guard' => 'web']);

        return $this->json($method, $uri, $data, $token ? ['Authorization' => 'Bearer '.$token] : []);
    }
}
