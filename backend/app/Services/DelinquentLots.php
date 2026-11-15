<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class DelinquentLots
{
    public function query(): Builder
    {
        $payments = DB::table('payments')->where('status', 'Válido')
            ->whereNotNull('lot_id')->groupBy('lot_id')
            ->selectRaw('lot_id, sum(amount_paid) as actual_paid');

        $today = Carbon::today()->toDateString();
        $lots = DB::table('lots')
            ->leftJoinSub($payments, 'paid', 'paid.lot_id', '=', 'lots.id')
            ->where('lots.status', 'Vendido')->whereNotNull('lots.customer_id')
            ->whereRaw('coalesce(paid.actual_paid, 0) < lots.total_price')
            ->select('lots.id', 'lots.customer_id', 'lots.project_id', 'lots.lot_number', 'lots.total_price')
            ->selectRaw(
                'coalesce(paid.actual_paid, 0) as actual_paid,
                 greatest(1, coalesce(nullif(installments_count, 0), 12)) as installments,
                 coalesce(nullif(payment_day, 0), 15) as payment_day,
                 coalesce(sale_date, cast(lots.created_at as date), cast(? as date)) as start_day,
                 cast(? as date) as today',
                [$today, $today]
            );

        // Reproduce Carbon::diffInMonths, including fractional months and month overflow.
        $dates = DB::query()->fromSub($lots, 'lots')
            ->selectRaw('*, least(start_day, today) as earlier, greatest(start_day, today) as later');
        $months = DB::query()->fromSub($dates, 'dates')->selectRaw('*, (
            (extract(year from later) - extract(year from earlier)) * 12
            + extract(month from later) - extract(month from earlier)
            - case when extract(day from earlier) > extract(day from later) then 1 else 0 end
        )::integer as whole_months');
        $bounds = DB::query()->fromSub($months, 'months')->selectRaw(
            "*, (date_trunc('month', earlier) + make_interval(months => whole_months))::date
                    + extract(day from earlier)::integer - 1 as floor_day,
                (date_trunc('month', earlier) + make_interval(months => whole_months + 1))::date
                    + extract(day from earlier)::integer - 1 as ceil_day"
        );
        $elapsed = DB::query()->fromSub($bounds, 'bounds')->selectRaw('*, (
            whole_months + case when floor_day >= later then 0
                else abs(later - floor_day)::double precision / (abs(ceil_day - later) + abs(later - floor_day)) end
            ) * case when start_day > today then -1 else 1 end as elapsed_months,
            round(total_price / installments, 2) as installment_amount');
        $due = DB::query()->fromSub($elapsed, 'elapsed')->selectRaw(
            "*, least(installments, greatest(0, case
                when extract(day from today) >= payment_day
                     and date_trunc('month', today) <> date_trunc('month', start_day) then elapsed_months + 1
                when elapsed_months = 0 and extract(day from today) >= payment_day
                     and extract(day from start_day) <= payment_day then 1
                else elapsed_months end)) as due_installments"
        );
        $balances = DB::query()->fromSub($due, 'due')->selectRaw(
            '*, round((due_installments * installment_amount)::numeric, 2) - actual_paid as overdue_balance'
        );

        return DB::query()->fromSub($balances, 'balances')->where('overdue_balance', '>', 0);
    }
}
