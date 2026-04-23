-- dbo.accounts_receivable_aging




CREATE proc [dbo].[accounts_receivable_aging]
	@age_days int,
	@ever_ready bit,
	@dixie_ems bit,
	@bp_medical bit
as

--this stored proc mimics point force AR84 with use of qualify aging (only, it does not expose other AR84 options, for that see other sp or sql file i have)

set nocount on;

declare @current_date datetime = current_timestamp;
declare @saloffs table(saloff char(2));

if @ever_ready = 1
	insert into @saloffs values ('01'), ('02');

if @dixie_ems = 1
	insert into @saloffs values ('03');

if @bp_medical = 1
	insert into @saloffs values ('04'), ('05');

if not exists (select 1 from @saloffs)
	insert into @saloffs values ('01'), ('02'), ('03'), ('04'), ('05');

select
	custs.CUSTMR, custs.CUSNAM, custs.TELPHN, custs.cust_age
	, case
		when custs.cust_age < 31 then 30
		when custs.cust_age < 46 then 45
		when custs.cust_age < 61 then 60
		when custs.cust_age < 91 then 90
		when custs.cust_age < 121 then 120
		else 121
		end as cust_aging_bucket
	, custs.cust_open_aged_balance
	, custs.cust_saloff
	, items.INVOICE, items.CUSTMRPO
	, case left(items.INVOICE, 1)
		when 'P' then 'POA'
		when 'D' then 'DM'
		else
			case isnull(items.DOCMNT, '')
				when 'NOTES' then 'CRN'
				when '' then 'UKN'
				else 'INV'
			end
		end as item_type
	, items.INVCDAT, items.INVCAMT, items.invoice_open_balance, items.invoice_age
	, activity.CHEQUE, activity.PAYDAT, activity.TRANSCTN, activity.PAYAMT
	, sum(items.invoice_open_balance) over(partition by custs.custmr) as cust_open_balance
	, sum(isnull(items.[1-30], 0)) over(partition by custs.custmr) as [cust_1-30]
	, sum(isnull(items.[31-60], 0)) over(partition by custs.custmr) as [cust_31-60]
	, sum(isnull(items.[61-90], 0)) over(partition by custs.custmr) as [cust_61-90]
	, sum(isnull(items.[91-120], 0)) over(partition by custs.custmr) as [cust_91-120]
	, sum(isnull(items.[121+], 0)) over(partition by custs.custmr) as [cust_121+]
from
	( --custs
		select
			a.CUSTMR, a.cust_aged_balance, a.total_balance, a.aging_date
			, datediff(DAY, a.aging_date, @current_date) as cust_age
			, case
				when b.sort_div <= 0 then 0.00 --handles cases where aged to total balance diff crosses over zero (< 0, = 0), or where total balance is 0 (= 0)
				when b.sort_div <= 1 then cust_aged_balance --handles aged balance is same as (= 0) or less then (< 0) current balance
				else total_balance --handles aged balance is greater then total balance
				end as cust_open_aged_balance
			, c.CUSNAM, c.SALOFF as cust_saloff, c.TELPHN
		from
			(
				select
					ar.CUSTMR
					, sum(ar.INVCAMT) + sum(ar.TOTPAY) as cust_aged_balance
					, min(ar.INVCDAT) as aging_date
					, (select sum(i.INVCAMT) + sum(i.TOTPAY) from r_arar i where i.CUSTMR = ar.CUSTMR) as total_balance --should realy use field in sucu, but its sometime corrupt data
				from
					R_ARAR ar
				where
					DATEDIFF(DAY, ar.INVCDAT, @current_date) >= @age_days
					and ar.INVCAMT + ar.TOTPAY <> 0
				group by
					ar.CUSTMR
			) a
			cross apply
			(
				select isnull(cust_aged_balance / nullif(total_balance, 0), 0) as sort_div
			) b
			inner join
			R_SUCU c
			on a.CUSTMR = c.CUSTMR
		where
			exists (select 1 from @saloffs sot where sot.saloff = c.saloff)
	) custs
	inner join
	( --items
		select
			a.CUSTMR, a.INVOICE, a.INVCDAT, a.INVCAMT, a.TOTPAY
			, b.invoice_age
			, case when b.invoice_age < 31 then a.INVCAMT + a.TOTPAY end as [1-30]
			, case when b.invoice_age between 31 and 60 then a.INVCAMT + a.TOTPAY end as [31-60]
			, case when b.invoice_age between 61 and 90 then a.INVCAMT + a.TOTPAY end as [61-90]
			, case when b.invoice_age between 91 and 120 then a.INVCAMT + a.TOTPAY end as [91-120]
			, case when b.invoice_age > 120 then a.INVCAMT + a.TOTPAY end as [121+]
			, a.INVCAMT + a.TOTPAY as invoice_open_balance
			, c.DOCMNT, c.CUSTMRPO, c.SALOFF as invoice_saloff
		from
			R_ARAR a
			cross apply
			(
				select datediff(DAY, a.INVCDAT, @current_date) as invoice_age
			) b
			left join
			R_INIH c
			on a.INVOICE = c.INVOICE
		where 
			a.INVCAMT + a.TOTPAY <> 0
	) items
	on custs.CUSTMR = items.CUSTMR
	left join
	R_INIHP activity
	on custs.CUSTMR = activity.CUSTMR and items.INVOICE = activity.INVOICE
order by
	custs.cust_open_aged_balance desc, custs.cust_aged_balance, custs.CUSTMR
	, items.INVCDAT, items.INVOICE
	, activity.PAYDAT, activity.CHEQUE, activity.TRANSCTN;

