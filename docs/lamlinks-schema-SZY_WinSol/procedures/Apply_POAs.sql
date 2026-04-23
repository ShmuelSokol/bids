-- dbo.Apply_POAs


CREATE proc [dbo].[Apply_POAs]
	@date as datetime
as


set nocount on;

declare @invoices_customers_payors table (
	INVOICE char(7) NULL,
	INVCDAT datetime NULL,
	SALORD char(6) NULL,
	DOCMNT varchar(8) NULL,
	CUSTMR varchar(7) NULL,
	CUSNAM varchar(30) NULL,
	PAYOFF varchar(7) NULL,
	PAYORNAME varchar(30) NULL,
	SALREP varchar(2) NULL,
	ORDSOU char(1) NULL,
	INVTO char(1) NULL,
	CUSTMRPO varchar(12) NULL,
	ORDDAT datetime NULL,
	SHIPTO varchar(6) NULL,
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
	I_EMAIL varchar(64) not null,
	U_ALWAYSEXCLUDEFROMDAILYREV char(1) not null
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
	invoice_balance numeric(10, 2) null
);

declare @payors table (
	PAYOFF varchar(7) not NULL,
	PAYORNAME varchar(30) NULL,
	money_on_account numeric(10, 2) null,
	account_balance numeric(10, 2) null
);

declare @customers table (
	CUSTMR varchar(7) not NULL,
	CUSNAM varchar(30) NULL
);

declare @terms table (
	TERMS varchar(6) NULL,
	TERMSDES varchar(15) NULL
);

declare @invoiceBalances table (
	PAYOFF varchar(7) not NULL,
	INVOICE char(7) not NULL,
	INVCDAT datetime not NULL,
	SALORD varchar(6) not NULL,
	BALANCE numeric(10, 2) not NULL
);

declare @resultSetInvoices table (
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
	PAYOFF varchar(7) NULL,
	PAYORNAME varchar(30) NULL,
	account_balance numeric(10, 2) null,
	money_on_account numeric(10, 2) null
);

declare @credits table (
	payoff varchar(7) not null,
	date datetime not null,
	reference varchar(7) not null,
	docmnt varchar(8) null,
	salord char(6) not null,
	balance numeric(10,2) not null,
	[check] varchar(8) null,
	checkAmount numeric(10,2) null
);

declare @resultSetCredits table (
	payoff varchar(7) not null,
	payorName varchar(30) not null,
	creditType varchar(30) not null,
	creditDate datetime not null,
	reference varchar(7) not null,
	salesOrder char(6) not null,
	balance numeric(10,2) not null,
	[check] varchar(8) not null,
	checkAmount numeric(10,2) null
);


/* start temp quick return

insert into @resultSetInvoices (PAYOFF, PAYORNAME, INVOICE, SALORD, ARTOT, invoice_balance, money_on_account, CUSTMRPO, TERMSDES)
values
('MIOR29 ','MED-TECH                      ','E156677','E53891',13.95,13.95,187.03,'192152      ','Net 30 Days'),
('MIOR29 ','MED-TECH                      ','E156686','E54481',50,50,187.03,'192422      ','Net 30 Days'),
('MIOR29 ','MED-TECH                      ','E156698','E54546',32.64,32.64,187.03,'192432      ','Net 30 Days'),
('MIOR29 ','MED-TECH                      ','E156700','E54549',40.69,40.69,187.03,'192437      ','Net 30 Days'),
('MIOR29 ','MED-TECH                      ','E156701','E54542',178.55,178.55,187.03,'192436      ','Net 30 Days'),
('FRMA01 ','FALL RIVER FIRE DEPT          ','F056158','F45359',2663.22,2663.22,303.34,'BETH        ','Net 30 Days'),
('GANY02 ','GUILFOYLE AMBULANCE           ','F056159','F45363',542.95,542.95,0.9,'JEFF        ','Net 30 Days'),
('MANY04 ','MIDWOOD AMBULANCE SVC         ','F056178','F45390',1794,1794,225.24,'MIKE        ','Net 30 Days'),
('MRRI01 ','MARINE RESCUE PRODUCTS        ','F056170','F45374',400,400,1704.3,'10278       ','Net 30 Days'),
('MSCT65 ','MUNICIPAL EMERGENCY SVC''S     ','F056189','F45354',76.5,76.5,89.25,'845090      ','Net 30 Days'),
('MSCT65 ','MUNICIPAL EMERGENCY SVC''S     ','F056191','F45396',282.07,282.07,89.25,'845050      ','Net 30 Days'),
('TENY03 ','TLC EMERGENCY MEDICAL SERVICES','F056182','F45389',5705.25,5705.25,5.81,'4-14-15     ','Net 30 Days'),
('LMSFL1 ','LIFE MEDICAL SUPPLIER         ','E156668','B10604',120.5,120.5,85,'11492       ','Net 30 Days')

insert into @resultSetCredits (payoff, payorName, creditType, creditDate, reference, salesOrder, balance, [check], checkAmount)
values
('FRMA01 ', '', 'Invoice','4/7/14','F046987','F01010',-303.34,'',null),
('GANY02 ', '', 'Invoice','10/28/14','F051752','F01010',-0.9,'',null),
('LMSFL1 ', '', 'Invoice','6/25/13','E118851','E01010',-75,'',null),
('LMSFL1 ', '', 'Invoice','1/6/15','E149391','B01010',-10,'',null),
('MANY04 ', '', 'Invoice','2/6/15','F054356','F01010',-225.24,'',null),
('MIOR29 ', '', 'POA','2/11/15','P021115','',-187.03,'8337    ',38465.37),
('MRRI01 ', '', 'POA','8/5/14','P080414','',-1704.3,'3783    ',3713.8),
('MSCT65 ', '', 'Invoice','12/30/14','F053418','F01010',-89.25,'',null),
('TENY03 ', '', 'Invoice','7/16/13','F041593','F01010',-5.81,'',null)


select
	ri.PAYOFF as Payor
	, ri.PAYORNAME as Name
	, ri.INVOICE as Invoice
	, ri.ARTOT as Total
	, ri.SALORD as [Sales Order]
	, ri.invoice_balance as Balance
	, ri.money_on_account as [Money on Account]
	, ri.CUSTMRPO as [PO Number]
	, ri.TERMSDES as Terms
from
	@resultSetInvoices ri
order by
	ri.SALOFF, ri.PAYOFF, ri.INVOICE

select
	rc.payoff as Payor
	, rc.creditType as [Credit Type]
	, rc.creditDate as Date
	, rc.reference as Reference
	, rc.salesOrder as [Sales Order]
	, rc.balance as Balance
	, rc.[check] as [Check]
	, rc.checkAmount as [Check Amount]
from
	@resultSetCredits rc
order by
	rc.payoff, rc.creditDate
	, case rc.creditType when 'POA' then 1 when 'Credit Note' then 2 when 'Debit Memo' then 3 when 'Invoice' then 4 else 0 end
	, rc.reference

return

--end temp quick return */






declare @sql nvarchar(max);
declare @cp varchar(7); --cursor payoff
declare @ci char(7); --cursor invoice
declare @cd varchar(8); --cursor docmnt
declare @ch varchar(8) = null; --check
declare @ca numeric(10,2) = null; --check amount

set @sql =
'select
	INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, CUSNAM, PAYOFF, PAYORNAME, SALREP, ORDSOU, INVTO
	, CUSTMRPO, ORDDAT, SHIPTO, TERMS, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS
	, ltrim(rtrim(I_EMAIL)) as I_EMAIL, ltrim(rtrim(U_ALWAYSEXCLUDEFROMDAILYREV)) as U_ALWAYSEXCLUDEFROMDAILYREV
from
	openquery (
		SZY_WinSol_ODBC, 
		''select
			{ fn ifnull(i.INVOICE, '''''''')} as INVOICE, i.INVCDAT, { fn ifnull(i.SALORD, '''''''')} as SALORD
			, { fn ifnull(i.DOCMNT, '''''''')} as DOCMNT, { fn ifnull(i.CUSTMR, '''''''')} as CUSTMR
			, { fn ifnull(c.CUSNAM, '''''''')} as CUSNAM, { fn ifnull(i.PAYOFF, '''''''')} as PAYOFF
			, { fn ifnull(p.CUSNAM, '''''''')} as PAYORNAME, { fn ifnull(i.SALREP, '''''''')} as SALREP
			, { fn ifnull(i.ORDSOU, '''''''')} as ORDSOU, { fn ifnull(i.INVTO, '''''''')} as INVTO
			, { fn ifnull(i.CUSTMRPO, '''''''')} as CUSTMRPO, i.ORDDAT, { fn ifnull(i.SHIPTO, '''''''')} as SHIPTO
			, { fn ifnull(i.TERMS, '''''''')} as TERMS, i.ARTOT, i.SALES, i.COS, i.SUPCHA
			, { fn ifnull(i.SALOFF, '''''''')} as SALOFF, i.TAX, i.SASALES, i.SACOS
			, { fn ifnull(i.STATUS, '''''''')} as STATUS, { fn concat({ fn ifnull(i.Z_EMAIL, '''''''')}, '''''''')} as I_EMAIL
			, { fn concat({ fn ifnull(c.U_ALWAYSEXCLUDEFROMDAILYREV, ''''N'''')}, '''''''')} as U_ALWAYSEXCLUDEFROMDAILYREV
		from
			inih i, sucu c, sucu p
		where
			i.invcdat = {d ''''' + convert(char(10), @date, 120) + '''''}
			and i.custmr = c.custmr
			and i.payoff = p.custmr
			and c.custyp <> ''''8''''
			'')';

print 'A MAIN:   ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

insert into @invoices_customers_payors
	(INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, CUSNAM, PAYOFF, PAYORNAME, SALREP, ORDSOU, INVTO
	, CUSTMRPO, ORDDAT, SHIPTO, TERMS, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS
	, I_EMAIL, U_ALWAYSEXCLUDEFROMDAILYREV)
exec (@sql);

print 'Z MAIN:   ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--remove customers we are not interested in:
delete from @invoices_customers_payors where U_ALWAYSEXCLUDEFROMDAILYREV = 'Y';

--remove deleted invoices:
delete from @invoices_customers_payors where DOCMNT = 'DELET';

print 'A TERMS:  ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--using a separate table var for terms because an equality join to suud_art.terms does not work in the pvx odbc deriver
insert into @terms 
	(TERMS, TERMSDES)
select
	TERMS, TERMSDES
from
	openquery (
		SZY_WinSol_ODBC, 
		'select { fn ifnull(TERMS, '''')} as TERMS, { fn ifnull(TERMSDES, '''')} as TERMSDES from suud_art'
	);

print 'Z TERMS:  ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

insert into @customers (CUSTMR, CUSNAM)
select CUSTMR, CUSNAM
from @invoices_customers_payors
group by CUSTMR, CUSNAM;

insert into @payors (PAYOFF, PAYORNAME, money_on_account, account_balance)
select PAYOFF, PAYORNAME, 0, 0
from @invoices_customers_payors
group by PAYOFF, PAYORNAME;

insert into @invoices (INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL)
select INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL
from @invoices_customers_payors
group by INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL;

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


--run the following cursor after removing all customers that can be removed without even knowing the balance (e.g. dd219)

--invoice_balance_cursor is used primarily to get the money_on_account and customer_balance values. it is also used as a first attempt
--to get the invoice balance, it will find this value (by getting invoices by customer) if the payoff is the same as customer and the
--invoice has a balance.

declare invoice_balance_by_payor_cursor cursor for
	select PAYOFF
	from @payors;

set @cp = null;

print 'A BALANC by payor: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open invoice_balance_by_payor_cursor;

fetch next from invoice_balance_by_payor_cursor into @cp;

while @@FETCH_STATUS = 0
begin
	set @sql =
	'select
		''' + @cp + ''' as PAYOFF, INVOICE, INVCDAT, isnull(SALORD, '''') as SALORD, BALANCE
	from
		openquery (
			SZY_WinSol_ODBC, 
			''select
				{ fn ifnull(a.INVOICE, '''''''')} as INVOICE
				, a.INVCDAT
				, { fn ifnull(a.SALORD, '''''''')} as SALORD
				, a.INVCAMT + a.TOTPAY as BALANCE
			from
				arar a
			where
				a.CUSTMR = ''''' + @cp + '''''
				and a.INVCAMT + a.TOTPAY <> 0
		'')';

	insert into @invoiceBalances exec (@sql);

	fetch next from invoice_balance_by_payor_cursor into @cp;
end

close invoice_balance_by_payor_cursor;
deallocate invoice_balance_by_payor_cursor;

print 'Z BALANC by payor: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

update p
	set p.account_balance = isnull(b.account_balance, 0)
from
	@payors p
	left join
	(
		select bi.PAYOFF, sum(bi.BALANCE) as account_balance
		from @invoiceBalances bi
		group by bi.PAYOFF
	) b
	on p.PAYOFF = b.PAYOFF;

insert into @credits (payoff, date, reference, salord, balance)
select b.PAYOFF, b.INVCDAT, ltrim(rtrim(b.INVOICE)), b.SALORD, b.BALANCE
from @invoiceBalances b
where b.BALANCE < 0;
	
update p
	set p.money_on_account = isnull(c.money_on_account, 0)
from
	@payors p
	left join
	(
		select c.PAYOFF, sum(c.BALANCE) as money_on_account
		from @credits c
		group by c.PAYOFF
	) c
	on P.PAYOFF = c.PAYOFF;

update i
	set i.invoice_balance = isnull(b.BALANCE, 0)
from
	@invoices i
	left join
	@invoiceBalances b
	on i.INVOICE = b.INVOICE;

delete i
from
	@invoices i
	inner join
	@payors p
	on i.PAYOFF = p.PAYOFF
where
	i.invoice_balance = 0
	or p.money_on_account = 0;

delete p
from
	@payors p
where
	not exists (select 1 from @invoices i where i.PAYOFF = p.PAYOFF);

delete cr
from
	@credits cr
where
	not exists (select 1 from @payors p where p.PAYOFF = cr.payoff);

delete c
from
	@customers c
where
	not exists (select 1 from @invoices i where i.CUSTMR = c.CUSTMR);

declare credit_docmnt_cursor cursor static for
	select reference
	from @credits
	where
		left(reference, 1) not in ('D', 'P') --D and P are not allowed as invoice prefixes in point force so they dont need to be included
		and salord <> ''; --salord cant be blank for an invoice, so dont bother looking for these. i dont think this removes anything beyond first condition...

set @ci = null;

print 'A DOCMNT: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open credit_docmnt_cursor;

fetch next from credit_docmnt_cursor into @ci;

while @@FETCH_STATUS = 0
begin
	set @sql =
		'select @xcd = DOCMNT
		from openquery (SZY_WinSol_ODBC, ''select { fn ifnull(DOCMNT, '''''''')} as DOCMNT from inih where invoice = ''''' + @ci + ''''''')'

	exec sp_executesql @sql, N'@xcd varchar(8) OUTPUT', @cd OUTPUT;
	
	if @cd is not null
		update @credits set docmnt = @cd where reference = @ci;

	set @cd = null;

	fetch next from credit_docmnt_cursor into @ci;
end

close credit_docmnt_cursor;
deallocate credit_docmnt_cursor;

print 'z DOCMNT: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

update @credits set docmnt = '' where docmnt is null;

declare credit_check_cursor cursor static for
	select payoff, reference
	from @credits
	where
		left(reference, 1) = 'P'; --point force allows only POA's to start with P, so left(reference, 1) = 'P' must be a POA

set @cp = null;
set @ci = null;

print 'A CHECK: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open credit_check_cursor;

fetch next from credit_check_cursor into @cp, @ci;

while @@FETCH_STATUS = 0
begin
	set @sql =
		'select top 1 @xch = CHEQUE, @xca = CHEAMT
		from openquery (SZY_WinSol_ODBC, 
			''select
				{ fn ifnull(CHEQUE, '''''''')} as CHEQUE, CHEAMT, { fn ifnull(TRANSCTN, '''''''')} as TRANSCTN
			from inihp
			where custmr = ''''' + @cp + ''''' and invoice = ''''' + @ci + '''''''
		)
		order by TRANSCTN'

	exec sp_executesql @sql, N'@xch varchar(8) OUTPUT, @xca numeric(10,2) OUTPUT', @ch OUTPUT, @ca OUTPUT;
	
	if @ch is not null
		update @credits set [check] = @ch, checkAmount = @ca where payoff = @cp and reference = @ci;

	set @ch = null;
	set @ca = null;

	fetch next from credit_check_cursor into @cp, @ci;
end

close credit_check_cursor;
deallocate credit_check_cursor;

print 'z CHECK: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

update @credits set [check] = '' where [check] is null;

insert into @resultSetInvoices (
	INVOICE, SALORD, CUSTMR, CUSNAM, CUSTMRPO, TERMSDES, ARTOT, SALOFF, sales_office_description, invoice_balance
	, PAYOFF, PAYORNAME, account_balance, money_on_account
)
select
	i.INVOICE, i.SALORD, i.CUSTMR, c.CUSNAM, i.CUSTMRPO, i.TERMSDES, i.ARTOT, i.SALOFF, i.sales_office_description, i.invoice_balance
	, i.PAYOFF, p.PAYORNAME, p.account_balance, - p.money_on_account as money_on_account
from
	@invoices i
	inner join @customers c on i.CUSTMR = c.CUSTMR
	inner join @payors p on i.PAYOFF = p.PAYOFF;

insert into @resultSetCredits (
	payoff, payorName
	, creditType
	, creditDate, reference
	, salesOrder
	, balance, [check], checkAmount
)
select
	cr.payoff, p.PAYORNAME
	, case left(cr.reference, 1)
		when 'P' then 'POA'
		when 'D' then 'Debit Memo'
		else case isnull(cr.docmnt, '') when 'NOTES' then 'Credit Note' else 'Invoice' end
	end as creditType
	, cr.date as creditDate, cr.reference
	, case
		when left(cr.reference, 1) in ('P', 'D') then
			case
				when len(cr.reference) = 7 and substring(cr.reference, 2, 1) in ('E', 'F', 'B') and right(cr.reference, 5) not like '%[^0-9]%' then right(cr.reference, 6)
				else ''
			end
		else
			case isnull(cr.docmnt, '')
				when 'NOTES' then ''
				else cr.salord
			end
	end as salesOrder
	, cr.balance, cr.[check], cr.checkAmount
from
	@credits cr
	inner join @payors p on cr.payoff = p.PAYOFF;

--return results
select
	ri.PAYOFF as Payor
	, ri.PAYORNAME as Name
	, ri.INVOICE as Invoice
	, ri.ARTOT as Total
	, ri.SALORD as [Sales Order]
	, ri.invoice_balance as Balance
	, ri.money_on_account as [Money on Account]
	, ri.CUSTMRPO as [PO Number]
	, ri.TERMSDES as Terms
from
	@resultSetInvoices ri
order by
	ri.SALOFF, ri.PAYOFF, ri.INVOICE

select
	rc.payoff as Payor
	, rc.creditType as [Credit Type]
	, rc.creditDate as Date
	, rc.reference as Reference
	, rc.salesOrder as [Sales Order]
	, rc.balance as Balance
	, rc.[check] as [Check]
	, rc.checkAmount as [Check Amount]
from
	@resultSetCredits rc
order by
	rc.payoff, rc.creditDate
	, case rc.creditType when 'POA' then 1 when 'Credit Note' then 2 when 'Debit Memo' then 3 when 'Invoice' then 4 else 0 end
	, rc.reference
