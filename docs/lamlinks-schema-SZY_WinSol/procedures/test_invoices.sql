-- dbo.test_invoices


CREATE proc [dbo].[test_invoices]
	@date as datetime
as


/** inconsistent ar data in point force

where do records in arrc fit into all this, i.e. what is arrc and does it add detail to arar/inihp?

--sucu.arbal <> arar.invcamt + arar.totpay:
--helen says to run ar87 (backdating the purge date to before the first invoice date so that nothing is purged)
--ran ar87 and now everything balances
--should keep checking for new instances...
select
	s.CUSTMR, s.CUSNAM, s.ARBAL, r.balance, s.ARBAL - r.balance as diff
	--into temp_sucu_arar_imbalance_before_diagnostic
from
	R_SUCU s
	inner join
	(
		select
			CUSTMR, sum(INVCAMT) + sum(TOTPAY) as balance
		from
			R_ARAR
		group by
			CUSTMR
	) r
	on s.CUSTMR = r.CUSTMR
where
	s.ARBAL <> r.balance


--arar.invcamt + arar.totpay <> sum(inihp.payamt):
--fixed by helen, but could happen again, so keep checking for new instances...
select
	r.CUSTMR, r.INVOICE, r.INVCAMT
	, r.TOTPAY as arar_TOTPAY, p.p_payamt as inihp_PAYAMT
	, r.INVCAMT + r.TOTPAY as arar_balance, r.INVCAMT + p.p_payamt as inihp_balance
	--into temp_arar_inihp_imbalance_before_diagnostic
from
	R_ARAR r
	inner join
	(
		select
			CUSTMR, INVOICE, sum(PAYAMT) as p_payamt
		from
			R_INIHP
		group by
			CUSTMR, INVOICE
	) p
	on r.CUSTMR = p.CUSTMR and r.INVOICE = p.INVOICE
where
	r.INVCAMT + r.TOTPAY <> r.INVCAMT + p.p_payamt
	
--arar items with payment value, but no record of the payment in inihp
--fixed by helen, but should keep checking for new instances
select
	a.*
from
	r_arar a
	left join
	r_inihp p
	on a.INVOICE = p.INVOICE and a.CUSTMR = p.CUSTMR
where
	p.INVOICE is null
	and a.TOTPAY <> 0

--**/




set nocount on;

declare @daysConsideredRecent smallint = 365;
declare @frequentInvoicesThreshold tinyint = 2;

declare @customerEmailDescription as char(16) = '[Account Email] ';
declare @invoiceEmailDescription as char(16) = '[Invoice Email] ';
declare @invoiceToPrefix as char(12) = 'INVOICE TO: ';
declare @iFaxDomain varchar(30) = '@rcfax.com';
declare @customerContactsDescription as char(11) = '[Contacts] ';

declare @invoices_customers_contacts table (
	INVOICE char(7) NULL,
	INVCDAT datetime NULL,
	SALORD char(6) NULL,
	DOCMNT varchar(8) NULL,
	CUSTMR varchar(7) NULL,
	CUSNAM varchar(30) NULL,
	FAX varchar(20) NULL,
	SALREP varchar(2) NULL,
	ORDSOU char(1) NULL,
	INVTO char(1) NULL,
	CUSTMRPO varchar(12) NULL,
	ORDDAT datetime NULL,
	SHIPTO varchar(6) NULL,
	PAYOFF varchar(7) NULL,
	TERMS varchar(6) NULL,
	ARTOT numeric(10, 2) NULL,
	SALES numeric(10, 2) NULL,
	COS numeric(10, 2) NULL,
	SUPCHA numeric(10, 2) NULL,
	SALOFF char(2) NULL,
	TAX numeric(8, 2) NULL,
	SASALES numeric(13, 2) NULL,
	SACOS numeric(13, 2) NULL,
	STATUS varchar(6) NULL,
	EMLINVCON varchar(12) not NULL,
	I_EMAIL varchar(64) not null,
	SENINV char(1) not null,
	CONTACT varchar(12) not null,
	FIRLAS varchar(61) not null,
	JOBTIT varchar(64) not null,
	T_EMAIL varchar(64) not null
);

declare @invoices table (
	INVOICE char(7) NULL,
	INVCDAT datetime NULL,
	SALORD char(6) NULL,
	DOCMNT varchar(8) NULL,
	CUSTMR varchar(7) NULL,
	SALREP varchar(2) NULL,
	ORDSOU char(1) NULL,
	INVTO char(1) NULL,
	CUSTMRPO varchar(12) NULL,
	ORDDAT datetime NULL,
	SHIPTO varchar(6) NULL,
	PAYOFF varchar(7) NULL,
	TERMS varchar(6) NULL,
	TERMSDES varchar(15) NULL,
	ARTOT numeric(10, 2) NULL,
	SALES numeric(10, 2) NULL,
	COS numeric(10, 2) NULL,
	SUPCHA numeric(10, 2) NULL,
	SALOFF char(2) NULL,
	sales_office_description varchar(30) null,
	TAX numeric(8, 2) NULL,
	SASALES numeric(13, 2) NULL,
	SACOS numeric(13, 2) NULL,
	STATUS varchar(6) NULL,
	I_EMAIL varchar(64) not null,
	invoice_notes varchar(max) not null,
	invoice_balance numeric(10, 2) null,
	invoicing_info varchar(max) not null
);

declare @customers table (
	CUSTMR varchar(7) not NULL,
	CUSNAM varchar(30) NULL,
	FAX varchar(20) null,
	C_EMAIL varchar(64) not null,
	SENINV char(1) not null,
	EMLINVCON varchar(12) not NULL,
	customer_notes varchar(max) not null,
	money_on_account numeric(10, 2) null,
	account_balance numeric(10, 2) null,
	send_invoice_to varchar(100) not null,
	email_contacts varchar(max) not null,
	recent_invoices_count int null
);

declare @contacts table (
	CUSTMR varchar(7) not NULL,
	CONTACT varchar(12) not null,
	FIRLAS varchar(61) not null,
	JOBTIT varchar(64) not null,
	T_EMAIL varchar(64) not null
);

declare @sucf table (
	CUSTMR varchar(7) NULL,
	Z_EMAIL varchar(64) NULL
)

declare @innot1 table (
	INVOICE varchar(7) NULL,
	CREDAT date NULL,
	CRETIM varchar(6) NULL,
	CREATR varchar(10) NULL,
	NOTTEX varchar(8000) NULL,
	MODDAT date NULL,
	MODTIM varchar(6) NULL,
	MODIFR varchar(10) NULL
);

declare @sunot1 table (
	CUSTMR varchar(7) NULL,
	CREDAT date NULL,
	CRETIM varchar(6) NULL,
	CREATR varchar(10) NULL,
	NOTTEX varchar(8000) NULL,
	MODDAT date NULL,
	MODTIM varchar(6) NULL,
	MODIFR varchar(10) NULL
);

declare @terms table (
	TERMS varchar(6) NULL,
	TERMSDES varchar(15) NULL
);

declare @invoiceBalances table (
	CUSTMR varchar(7) NULL,
	INVOICE char(7) NULL,
	BALANCE numeric(10, 2) NULL
);

declare @resultSet table (
	INVOICE char(7) NULL,
	SALORD char(6) NULL,
	CUSTMR varchar(7) NULL,
	CUSNAM varchar(30) NULL,
	CUSTMRPO varchar(12) NULL,
	TERMSDES varchar(15) NULL,
	ARTOT numeric(10, 2) NULL,
	SALOFF char(2) NULL,
	sales_office_description varchar(30) null,
	invoice_balance numeric(10, 2) null,
	money_on_account numeric(10, 2) null,
	notes varchar(max) null,
	invoicing_info varchar(max) null
);

declare @sql nvarchar(max);
declare @cc varchar(7); --cursor customer
declare @cp varchar(7); --cursor payoff
declare @ci char(7); --cursor invoice
declare @cd date; --cursor modified date
declare @cm varchar(10); --cursor note modifier
declare @cn varchar(max); --cursor note
declare @lastCc varchar(7); --last cursor customer
declare @lastCi char(7); --last cursor invoice
declare @collectCn varchar(max); --collect (consolidated) cursor note
declare @cfk varchar(20); --cursor customer fax key
declare @cfc varchar(20); --cursor customer fax clean
declare @i int;
declare @cfl varchar(61); --cursor firlas
declare @cj varchar(64); --cursor jobtit
declare @cce varchar(64); --cursor contacts email
declare @collectCe varchar(max); --collect (consolidated) cursor contact email
declare @cic int; --cursor invoice count

set @sql =
'select
	INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, CUSNAM, FAX, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, ltrim(rtrim(isnull(EMLINVCON, ''''))) as EMLINVCON
	, ltrim(rtrim(isnull(I_EMAIL, ''''))) as I_EMAIL, isnull(SENINV, '''') as SENINV
	, ltrim(rtrim(isnull(CONTACT, ''''))) as CONTACT
	, ltrim(rtrim(isnull(FIRLAS, ''''))) as FIRLAS
	, ltrim(rtrim(isnull(JOBTIT, ''''))) as JOBTIT
	, ltrim(rtrim(isnull(T_EMAIL, ''''))) as T_EMAIL
from
	openquery (
		SZY_WinSol_ODBC, 
		''select
			i.INVOICE, i.INVCDAT, i.SALORD, i.DOCMNT, i.CUSTMR, c.CUSNAM, c.FAX, i.SALREP, i.ORDSOU, i.INVTO, i.CUSTMRPO, i.ORDDAT, i.SHIPTO, i.PAYOFF, i.TERMS
			, i.ARTOT, i.SALES, i.COS, i.SUPCHA, i.SALOFF, i.TAX, i.SASALES, i.SACOS, i.STATUS, c.EMLINVCON, i.Z_EMAIL as I_EMAIL, c.SENINV
			, t.CONTACT, t.FIRLAS, t.JOBTIT, t.EMAIL as T_EMAIL
		from
			inih i, {oj sucu c left join cmsu ct left join cmcm t on ct.contact = t.contact on ct.custmr = c.custmr}
		where
			i.invcdat = {d ''''' + convert(char(10), @date, 120) + '''''}
			and i.custmr = c.custmr
			and c.custyp <> ''''8''''
			'')';

print 'A MAIN:   ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

insert into @invoices_customers_contacts
	(INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, CUSNAM, FAX, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, EMLINVCON, I_EMAIL, SENINV
	, CONTACT, FIRLAS, JOBTIT, T_EMAIL)
exec (@sql);

print 'Z MAIN:   ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

print 'A SUCF:   ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--using a separate query for sucf as sucf is missing some sucu keys (really?) so an inner join with sucu would drop some customers
set @sql =
'select
	CUSTMR, Z_EMAIL
from
	openquery (
		SZY_WinSol_ODBC, 
		''select
			f.CUSTMR, f.Z_EMAIL
		from
			inih i, sucf f
		where
			i.invcdat = {d ''''' + convert(char(10), @date, 120) + '''''}
			and i.custmr = f.custmr
			'')
group by
	CUSTMR, Z_EMAIL
';

insert into @sucf
	(CUSTMR, Z_EMAIL)
exec (@sql);

print 'Z SUCF:   ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--temp to remove customers we are not interested in:
delete from @invoices_customers_contacts where CUSTMR in ('DD219','#05','WA981D','AMACA','MP-AMUS','MP-AMNS','MP-AMNC','MP-AMUK','MP-EBUS'
	,'MP-EBNS','MP-EBNC','MP-EMUS','MP-EMNS','MP-EMNC','MP-GOUS','MP-AFNC','MP-AFNS','MP-AFUS','SPUK01','OVRSTOC','NEWEGG');

--temp to remove deleted invoices:
delete from @invoices_customers_contacts where DOCMNT = 'DELET';

--sync @sucf with @invoices_customers_contacts after we may have removed some customers
delete s from @sucf s where not exists (select 1 from @invoices_customers_contacts icc where icc.CUSTMR = s.CUSTMR)

print 'A TERMS:  ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--using a separate table var for terms because an equality join to suud_art.terms does not work in the pvx odbc deriver
insert into @terms 
	(TERMS, TERMSDES)
select
	TERMS, TERMSDES
from
	openquery (
		SZY_WinSol_ODBC, 
		'select TERMS, TERMSDES from suud_art'
	);

print 'Z TERMS:  ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

insert into @customers (CUSTMR, CUSNAM, FAX, C_EMAIL, SENINV, EMLINVCON, customer_notes, money_on_account, account_balance, send_invoice_to, email_contacts)
select CUSTMR, CUSNAM, FAX, '', SENINV, EMLINVCON, '', 0, 0, '', ''
from @invoices_customers_contacts
group by CUSTMR, CUSNAM, FAX, SENINV, EMLINVCON;

insert into @invoices (INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL, invoice_notes, invoicing_info)
select INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL, '', ''
from @invoices_customers_contacts
group by INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL;

insert into @contacts (CUSTMR, CONTACT, FIRLAS, JOBTIT, T_EMAIL)
select CUSTMR, CONTACT, FIRLAS, JOBTIT, T_EMAIL
from @invoices_customers_contacts
where CONTACT <> ''
group by CUSTMR, CONTACT, FIRLAS, JOBTIT, T_EMAIL;

update c
	set c.C_EMAIL = ltrim(rtrim(isnull(f.Z_EMAIL, '')))
from
	@customers c
	inner join
	@sucf f
	on c.CUSTMR = f.CUSTMR

update c
	set c.recent_invoices_count = i.ic
from
	@customers c
	inner join
	(
		select ii.CUSTMR, count(*) as ic from @invoices ii group by ii.CUSTMR
	) i
	on c.CUSTMR = i.CUSTMR

update i
	set i.TERMSDES = t.TERMSDES
from
	@invoices i
	inner join
	@terms t
	on i.TERMS = t.TERMS;

--don't know where point force stores sales office description in the database
update @invoices set sales_office_description = 
	case SALOFF 
		when '01' then 'SZY'
		when '02' then 'Ever Ready'
		when '03' then 'Dixie EMS'
		when '04' then 'BP Medical'
		when '05' then 'Amazon Fulfillment'
		else 'Unknown' end;

print 'A customer contacts: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--consolidate all customer email contacts into one row section
	declare customer_email_contacts_cursor cursor for
		select CUSTMR, FIRLAS, JOBTIT, T_EMAIL
		from @contacts
		where T_EMAIL <> ''
		order by CUSTMR, JOBTIT, FIRLAS, T_EMAIL;
	
	--note: be sure to update the contacts with a trimmed, non null value. later processing expects this.
	open customer_email_contacts_cursor;

	fetch next from customer_email_contacts_cursor into @cc, @cfl, @cj, @cce;

	if @@FETCH_STATUS = 0
	begin
		set @lastCc = @cc;
		set @collectCe = '';

		while @@FETCH_STATUS = 0
		begin
			if @lastCc = @cc
				set @collectCe = @collectCe + char(13) + char(10)
					+ case @cj
						when '' then @cfl + ', ' + @cce
						else @cj + ' (' + @cfl + '), ' + @cce
						end;
			else
			begin
				update @customers set email_contacts = ltrim(rtrim(isnull(@collectCe, ''))) where CUSTMR = @lastCc;
				
				set @lastCc = @cc;
				
				set @collectCe = case @cj
						when '' then @cfl + ', ' + @cce
						else @cj + ' (' + @cfl + '), ' + @cce
						end;
			end
			
			fetch next from customer_email_contacts_cursor into @cc, @cfl, @cj, @cce;
		end

		--do last insert
		update @customers set email_contacts = ltrim(rtrim(isnull(@collectCe, ''))) where CUSTMR = @lastCc;
	end

	close customer_email_contacts_cursor;
	deallocate  customer_email_contacts_cursor;
--end consolidate all customer email contacts into one row section

print 'Z customer contacts: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--replace leading, trailing and double line brakes section
update @customers set email_contacts = dbo.cleanLineBreaks(email_contacts);

--not joining to inih because it slows the query down in this case, even though we are using keys
insert into @innot1
	(INVOICE, CREDAT, CRETIM, CREATR, NOTTEX, MODDAT, MODTIM, MODIFR)
select
	a.INVOICE, a.CREDAT, a.CRETIM, a.CREATR, a.NOTTEX, a.MODDAT, a.MODTIM, a.MODIFR
from
	openquery (
		SZY_WinSol_ODBC, 
		'select INVOICE, CREDAT, CRETIM, CREATR, NOTTEX, MODDAT, MODTIM, MODIFR
		from innot1'
	) a
where
	exists (select i.INVOICE from @invoices i where i.INVOICE = a.INVOICE);

print 'Z INNOT1: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

print 'A SUNOT1: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--not joining to inih because it slows the query down in this case, even though we are using keys
insert into @sunot1
	(CUSTMR, CREDAT, CRETIM, CREATR, NOTTEX, MODDAT, MODTIM, MODIFR)
select
	a.CUSTMR, a.CREDAT, a.CRETIM, a.CREATR, a.NOTTEX, a.MODDAT, a.MODTIM, a.MODIFR
from
	openquery (
		SZY_WinSol_ODBC, 
		'select CUSTMR, CREDAT, CRETIM, CREATR, NOTTEX, MODDAT, MODTIM, MODIFR
		from sunot1'
	) a
where
	exists (select i.CUSTMR from @invoices i where i.CUSTMR = a.CUSTMR);

print 'Z SUNOT1: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--consolidate all customer notes into one row section
	declare customer_notes_cursor cursor for
		select CUSTMR, MODDAT, MODIFR, NOTTEX
		from @sunot1
		order by CUSTMR, MODDAT desc, MODTIM desc;

	--note: be sure to update the note with a trimmed, non null value. later processing expects this.
	open customer_notes_cursor;

	set @cd = null;
	set @cm = null;
	set @cn = null;

	fetch next from customer_notes_cursor into @cc, @cd, @cm, @cn;

	if @@FETCH_STATUS = 0
	begin
		set @lastCc = @cc;
		set @collectCn = '';

		while @@FETCH_STATUS = 0
		begin
			if @lastCc = @cc
				set @collectCn = @collectCn + char(13) + char(10)
					+ '[' + convert(char(10), isnull(@cd, convert(date,'1/1/1900')), 101) + ' ' + ltrim(rtrim(isnull(@cm, ''))) + '] ' + ltrim(rtrim(@cn));
			else
			begin
				update @customers set customer_notes = ltrim(rtrim(isnull(@collectCn, ''))) where CUSTMR = @lastCc;

				set @lastCc = @cc;

				set @collectCn = '[' + convert(char(10), isnull(@cd, convert(date,'1/1/1900')), 101) + ' ' + ltrim(rtrim(isnull(@cm, ''))) + '] ' + ltrim(rtrim(@cn));
			end

			fetch next from customer_notes_cursor into @cc, @cd, @cm, @cn;
		end

		--do last insert
		update @customers set customer_notes = ltrim(rtrim(isnull(@collectCn, ''))) where CUSTMR = @lastCc;
	end

	close customer_notes_cursor;
	deallocate  customer_notes_cursor;
--end consolidate all customer notes into one row section

update @customers set customer_notes = dbo.cleanLineBreaks(customer_notes);

update @innot1 set NOTTEX = dbo.cleanLineBreaks(NOTTEX);

--consolidate all invoice notes into one row section
	declare invoice_notes_cursor cursor for
		select INVOICE, MODDAT, MODIFR, NOTTEX
		from @innot1
		order by INVOICE, MODDAT desc, MODTIM desc;

	--note: be sure to update the note with a trimmed, non null value. later processing expects this.
	
	open invoice_notes_cursor;

	set @cd = null;
	set @cm = null;
	set @cn = null;

	fetch next from invoice_notes_cursor into @ci, @cd, @cm, @cn;

	if @@FETCH_STATUS = 0
	begin
		set @lastCi = @ci;
		set @collectCn = '[INVOICE NOTE ' + ltrim(rtrim(isnull(@cm, ''))) + '] ' + replace(ltrim(rtrim(@cn)), char(13) + char(10), ' | ');

		fetch next from invoice_notes_cursor into @ci, @cd, @cm, @cn;

		while @@FETCH_STATUS = 0
		begin
			if @lastCi = @ci
				set @collectCn = @collectCn + char(13) + char(10)
					+ '[INVOICE NOTE ' + ltrim(rtrim(isnull(@cm, ''))) + '] ' + replace(ltrim(rtrim(@cn)), char(13) + char(10), ' | ');
			else
			begin
				update @invoices set invoice_notes = ltrim(rtrim(isnull(@collectCn, ''))) where INVOICE = @lastCi;

				set @lastCi = @ci;

				set @collectCn = '[INVOICE NOTE ' + ltrim(rtrim(isnull(@cm, ''))) + '] ' + replace(ltrim(rtrim(@cn)), char(13) + char(10), ' | ');
			end

			fetch next from invoice_notes_cursor into @ci, @cd, @cm, @cn;
		end

		--do last insert
		update @invoices set invoice_notes = ltrim(rtrim(isnull(@collectCn, ''))) where INVOICE = @lastCi;
	end

	close invoice_notes_cursor;
	deallocate  invoice_notes_cursor;
--end consolidate all invoice notes into one row section

print 'Z CONSOL: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--run the following cursor after removing all customers that can be removed without even knowing the balance (e.g. dd219)

--invoice_balance_cursor is used primarily to get the money_on_account and customer_balance values. it is also used as a first attempt
--to get the invoice balance, it will find this value (by getting invoices by customer) if the payoff is the same as customer and the
--invoice has a balance.

declare invoice_balance_by_customer_cursor cursor for
	select custmr
	from @customers;

set @cc = null;

print 'A BALANC by customer: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open invoice_balance_by_customer_cursor;

fetch next from invoice_balance_by_customer_cursor into @cc;

while @@FETCH_STATUS = 0
begin
	set @sql =
	'select
		''' + @cc + ''' as CUSTMR, INVOICE, BALANCE
	from
		openquery (
			SZY_WinSol_ODBC, 
			''select
				a.INVOICE, a.INVCAMT + a.TOTPAY as BALANCE
			from
				arar a
			where
				a.CUSTMR = ''''' + @cc + '''''
		'')';

	insert into @invoiceBalances exec (@sql);

	fetch next from invoice_balance_by_customer_cursor into @cc;
end

close invoice_balance_by_customer_cursor;
deallocate invoice_balance_by_customer_cursor;

print 'Z BALANC by customer: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

update c
	set c.account_balance = isnull(b.account_balance, 0)
from
	@customers c
	left join
	(
		select bi.CUSTMR, sum(bi.BALANCE) as account_balance
		from @invoiceBalances bi
		group by bi.CUSTMR
	) b
	on c.CUSTMR = b.CUSTMR;

update c
	set c.money_on_account = isnull(b.money_on_account, 0)
from
	@customers c
	left join
	(
		select bi.CUSTMR, sum(bi.BALANCE) as money_on_account
		from @invoiceBalances bi
		where bi.BALANCE < 0
		group by bi.CUSTMR
	) b
	on c.CUSTMR = b.CUSTMR;

--add balance info for rare cases where payoff <> custmr.

declare invoice_balance_by_invoice_cursor cursor for
	select i.PAYOFF, i.INVOICE
	from @invoices i
	where
		not exists (select 1 from @invoiceBalances ib where i.INVOICE = ib.INVOICE)
		and i.CUSTMR <> i.PAYOFF;

set @cp = null;
set @ci = null;

print 'A BALANC by invoice: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open invoice_balance_by_invoice_cursor;

fetch next from invoice_balance_by_invoice_cursor into @cp, @ci;

while @@FETCH_STATUS = 0
begin
	set @sql =
	'select
		''' + @cp + ''' as CUSTMR, ''' + @ci + ''' as INVOICE, BALANCE
	from
		openquery (
			SZY_WinSol_ODBC, 
			''select
				a.CUSTMR, a.INVCAMT + a.TOTPAY as BALANCE
			from
				arar a
			where
				a.CUSTMR = ''''' + @cp + ''''' and a.INVOICE = ''''' + @ci + '''''
		'')';

	insert into @invoiceBalances exec (@sql);

	fetch next from invoice_balance_by_invoice_cursor into @cp, @ci;
end

print 'Z BALANC by invoice: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

close invoice_balance_by_invoice_cursor;
deallocate invoice_balance_by_invoice_cursor;

update i
	set i.invoice_balance = isnull(b.BALANCE, 0)
from
	@invoices i
	left join
	@invoiceBalances b
	on i.INVOICE = b.INVOICE;

declare customer_fax_cursor cursor for
	select ltrim(rtrim(isnull(FAX, ''))) as FAX
	from @customers
	group by ltrim(rtrim(isnull(FAX, '')));

open customer_fax_cursor;

fetch next from customer_fax_cursor into @cfk;

while @@FETCH_STATUS = 0
begin
	set @cfc = @cfk;

	set @i = PATINDEX('%[^0-9]%', @cfc);

	while @i > 0
	begin
		set @cfc = left(@cfc, @i -1) + SUBSTRING(@cfc, @i + 1, 20);
		set @i = PATINDEX('%[^0-9]%',@cfc);
	end;

	update @customers set FAX = @cfc where ltrim(rtrim(isnull(FAX, ''))) = @cfk;

	fetch next from customer_fax_cursor into @cfk;
end

close customer_fax_cursor;
deallocate customer_fax_cursor;

update @customers set FAX = SUBSTRING(FAX, 2, 19) where left(FAX, 1) = '1';
update @customers set FAX = '' where len(FAX) <> 10;
update @customers set FAX = '1' + FAX where FAX <> '';

--SENINV values are static so i am not concerned about new values
update c
	set c.send_invoice_to = case c.SENINV
		when 'M' then @invoiceToPrefix + 'Regular Mail'
		when 'H' then @invoiceToPrefix + 'Don''t Send'
		when 'F' then @invoiceToPrefix + 'Fax - ' + case len(c.FAX) when 0 then 'fax number is missing or is not valid' else c.FAX + @iFaxDomain end
		--next clause needs to handle blank email addresses since point force allows user to set "send invoice to" to an email contact that does
		--not have an email address, and also i dont trust it to maintain referential integrity regarding deletes of existing contact email addresses
		when 'E' then @invoiceToPrefix + case isnull(t.T_EMAIL, '') when '' then 'Email, email address is missing' else t.T_EMAIL end
		else ''	end
from
	@customers c left join @contacts t on c.EMLINVCON = t.CONTACT;

update i set
	i.invoicing_info = c.send_invoice_to
from
	@customers c inner join @invoices i on c.CUSTMR = i.CUSTMR
where
	c.send_invoice_to <> '';

declare invoice_count_cursor cursor static for
	select c.CUSTMR
	from @customers c
	where c.send_invoice_to = '' and isnull(c.recent_invoices_count, 0) < @frequentInvoicesThreshold;

set @cc = null;

print 'A INVOICE COUNT: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open invoice_count_cursor;

fetch next from invoice_count_cursor into @cc;

while @@FETCH_STATUS = 0
begin
	set @sql =
		'select @xcic = invoice_count
		from openquery(szy_winsol_odbc,	''
			select
				count(*) as invoice_count
			from
				inih i
			where
				i.custmr = ''''' + @cc + '''''
				and i.invcdat > {d ''''' + convert(char(10), dateadd(D, -(@daysConsideredRecent + 1), @date), 120) + ''''' }
			group by
				i.custmr
		'')'
	
	exec sp_executesql @sql, N'@xcic int OUTPUT', @cic OUTPUT;

	update @customers set recent_invoices_count = isnull(@cic, 0) where CUSTMR = @cc;

	fetch next from invoice_count_cursor into @cc;
end

print 'Z INVOICE COUNT: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

close invoice_count_cursor;
deallocate invoice_count_cursor;

update i set
	i.invoicing_info = dbo.cleanLineBreaks(
		case when c.recent_invoices_count >= @frequentInvoicesThreshold then 'SET UP ACCOUNTS PAYABLE' + char(10) else '' end
		+ c.customer_notes + char(10)
		+ case c.C_EMAIL when '' then '' else  @customerEmailDescription + c.C_EMAIL end + char(10)
		+ case i.I_EMAIL when '' then ''
			else case when i.I_EMAIL = c.C_EMAIL then '' else @invoiceEmailDescription + i.I_EMAIL end
		  end + char(10)
		+ case c.email_contacts when '' then '' else  @customerContactsDescription + c.email_contacts end + char(10)
	)
from
	@invoices i inner join @customers c on i.CUSTMR = c.CUSTMR
where
	i.invoicing_info = '';

insert into @resultSet
(
	INVOICE, SALORD, CUSTMR, CUSNAM, CUSTMRPO, TERMSDES, ARTOT, SALOFF, sales_office_description, invoice_balance
	, invoicing_info
	, notes
	, money_on_account
)
select
	i.INVOICE, i.SALORD, i.CUSTMR, c.CUSNAM, i.CUSTMRPO, i.TERMSDES, i.ARTOT, i.SALOFF, i.sales_office_description, i.invoice_balance
	, i.invoicing_info
	, case len(left(c.customer_notes, 1) + left(i.invoice_notes, 1))
		when 2 then i.invoice_notes + char(13) + char(10) + c.customer_notes
		else i.invoice_notes + c.customer_notes
		end
	, - c.money_on_account as money_on_account
from
	@invoices i inner join @customers c on i.CUSTMR = c.CUSTMR;

--temp to remove dixie and bp website orders that have 0 balance
delete @resultSet
from @resultSet r inner join @invoices i on r.INVOICE = i.INVOICE
where i.ORDSOU in ('B','D') and r.invoice_balance = 0;

delete @resultSet
from @resultSet r inner join @invoices i on r.INVOICE = i.INVOICE
where i.DOCMNT = 'NOTES';

--return results
select
	r.CUSTMR as Customer
	, r.CUSNAM as Name
	, r.invoicing_info as [Invoicing Info]
	, r.INVOICE as Invoice
	, null as [Action]
	, r.CUSTMRPO as [PO Number]
	, r.TERMSDES as Terms
	, r.ARTOT as Total
	, r.invoice_balance as Balance
	, r.money_on_account as [Money on Account]
	, r.SALORD as [Sales Order]
	, r.notes as [Invoice and Customer Notes]
from
	@resultSet r
order by
	r.SALOFF, r.CUSTMR, r.INVOICE

