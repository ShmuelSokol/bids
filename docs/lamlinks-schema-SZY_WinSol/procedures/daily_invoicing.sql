-- dbo.daily_invoicing


CREATE proc [dbo].[daily_invoicing]
	--@qd tinyint --comment out for normal mode
	@date as datetime --comment out for quick results mode
as


set nocount on;

--this sp was created for and currently used by the Daily Invoicing excel file

/* quick results for development section

/*
quick result tables are created by add the "into table_name" clause to the result sets at the end of this proc
the following mods are needed after creating the result sets:

alter table temp_resultSet add SALOFF char(6);
alter table temp_resultSet_B add SALOFF char(6);
alter table temp_excludedInvoicesCredits add SALOFF char(6);
alter table temp_excludedInvoicesCredits_B add SALOFF char(6);

update r set r.SALOFF = i.SALOFF from temp_resultSet r left join r_inih i on r.Invoice = i.INVOICE;
update r set r.SALOFF = i.SALOFF from temp_resultSet_B r left join r_inih i on r.Invoice = i.INVOICE;
update r set r.SALOFF = i.SALOFF from temp_excludedInvoicesCredits r left join r_inih i on r.Invoice = i.INVOICE;
update r set r.SALOFF = i.SALOFF from temp_excludedInvoicesCredits_B r left join r_inih i on r.Invoice = i.INVOICE;

alter table temp_resultSet alter column SALOFF char(6) not null;
alter table temp_resultSet_B alter column SALOFF char(6) not null;
alter table temp_excludedInvoicesCredits alter column SALOFF char(6) not null;
alter table temp_excludedInvoicesCredits_B alter column SALOFF char(6) not null;
*/

if @qd = 1
begin
	--unique_send_to_ids
	select invoice, unique_send_to_id
	from temp_unique_send_to_ids;

	--@customersWithExcludes
	select custmr
	from temp_customersWithExcludes
	order by custmr;

	--invoices to process:
	select
		r.Customer
		, r.Name
		, r.[Invoicing Instructions]
		, r.INVOICE as Invoice
		, r.[Invoicing Action]
		, '' as Charge
		, r.[PO Number]
		, r.Terms
		, r.Total
		, r.Balance
		, r.[Money on Account]
		, r.[Sales Order]
		, r.[Invoice and Customer Notes]
	from
		temp_resultSet r
	order by
		r.SALOFF, r.Customer, r.INVOICE;

	--@excludedInvoices all others
	select [Exclude Reason], Invoices, Total, Balance
	from temp_excludedInvoicesOthers
	order by [Exclude Reason];

	--@excludedCustomers
	select Customer, Name, [Invoices/Credits], Total, 3 as [Money on Account]
	from temp_excludedCustomers
	order by Customer;

	--@excludedInvoices.exclude_reason = @excludeReasonCreditNote
	select
		Customer, Name, Invoice, Total, Balance, [Sales Order], [PO Number]
	from temp_excludedInvoicesCredits
	order by SALOFF, Customer, Invoice;
end
else if @qd = 2
begin
	--unique_send_to_ids
	select invoice, unique_send_to_id
	from temp_unique_send_to_ids_B;

	--@customersWithExcludes
	select custmr
	from temp_customersWithExcludes_B
	order by custmr;

	--invoices to process:
	select
		r.Customer
		, r.Name
		, r.[Invoicing Instructions]
		, r.INVOICE as Invoice
		, r.[Invoicing Action]
		, '' as Charge
		, r.[PO Number]
		, r.Terms
		, r.Total
		, r.Balance
		, r.[Money on Account]
		, r.[Sales Order]
		, r.[Invoice and Customer Notes]
	from
		temp_resultSet_B r
	order by
		r.SALOFF, r.Customer, r.INVOICE;

	--@excludedInvoices all others
	select [Exclude Reason], Invoices, Total, Balance
	from temp_excludedInvoicesOthers_B
	order by [Exclude Reason];

	--@excludedCustomers
	select Customer, Name, [Invoices/Credits], Total, 3 as [Money on Account]
	from temp_excludedCustomers_B
	order by Customer;

	--@excludedInvoices.exclude_reason = @excludeReasonCreditNote
	select
		Customer, Name, Invoice, Total, Balance, [Sales Order], [PO Number]
	from temp_excludedInvoicesCredits_B
	order by SALOFF, Customer, Invoice;
end

return;


-- end quick results for development section */



--/* real section, commented out so that server never tries to look at point force odbc

print 'START: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

declare @daysConsideredRecent smallint = 365;
declare @frequentInvoicesThreshold tinyint = 2;

declare @customerEmailDescription char(16) = '[Account Email] ';
declare @invoiceEmailDescription char(16) = '[Invoice Email] ';
declare @invoiceToPrefix char(12) = 'INVOICE TO: ';
declare @iFaxDomain varchar(30) = '@rcfax.com';
declare @customerContactsDescription char(11) = '[Contacts] ';
declare @excludeString char(7) = 'Exclude'; --this string must match what the excel vba expects it to be
declare @instruction char(13) = 'INSTRUCTION: ';
--all the exclude reason vars might need to match the vba code in the excel sheet, modify after checking
declare @excludeReasonCreditNote varchar(100) = 'credit note';
declare @excludeReason0Balance varchar(100) = '0 balance exclude';
declare @excludeReasonPaidWebsiteOrder varchar(100) = 'fully paid website order';

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
	U_VOUCHER_REQUIRED char(1) not null,
	U_MAILING_ADDRESS_IN_NOTES char(1) not null,
	U_SEND_0_BALANCE_INVOICES char(1) not null,
	U_OTHER_INVOICING_INSTRUCT varchar(113) not null,
	U_EXCLUDE0BALANFROMDAILYREV char(1) not null,
	U_ALWAYSEXCLUDEFROMDAILYREV char(1) not null,
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
	INVOICE char(7) primary key not NULL,
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
	invoice_notes varchar(8000) not null,
	invoice_balance numeric(10, 2) null,
	invoicing_instructions varchar(8000) not null,
	unique_send_to_id smallint not null --this number starts at 1 for the first invoice sending destination with all invoices for the same
										  --customer with that destination getting a 1, if another destination is found for invoices for this
										  --customer then we increment to 2 and set the destination for those invoices as 2, etc.
										  --so for each date, for each customer, each invoice destination will have a unique id and all invoices
										  --with that destination will be marked with that id
);

declare @customers table (
	CUSTMR varchar(7) primary key not NULL,
	CUSNAM varchar(30) NULL,
	FAX varchar(20) null,
	C_EMAIL varchar(64) not null,
	SENINV char(1) not null,
	VOUCHER_REQUIRED bit not null,
	MAILING_ADDRESS_IN_NOTES bit not null,
	SEND_0_BALANCE_INVOICES bit not null,
	OTHER_INVOICING_INSTRUCT varchar(113) not null,
	EXCLUDE_0_BALANCE bit not null,
	ALWAYS_EXCLUDE bit not null,
	EMLINVCON varchar(12) not NULL,
	customer_notes varchar(8000) not null,
	money_on_account numeric(10, 2) null,
	account_balance numeric(10, 2) null,
	email_contacts varchar(8000) not null,
	recent_invoices_count int null,
	has_excluded_invoices bit not null
);

declare @contacts table (
	CUSTMR varchar(7) not NULL,
	CONTACT varchar(12) primary key not null,
	FIRLAS varchar(61) not null,
	JOBTIT varchar(64) not null,
	T_EMAIL varchar(64) not null
);

declare @sucf table (
	CUSTMR varchar(7) primary key not NULL,
	Z_EMAIL varchar(64) NULL
)

declare @innot1 table (
	INVOICE varchar(7) not NULL,
	CREDAT date not NULL,
	CRETIM varchar(6) not NULL,
	CREATR varchar(10) not NULL,
	NOTTEX varchar(8000) NULL,
	MODDAT date NULL,
	MODTIM varchar(6) NULL,
	MODIFR varchar(10) NULL,
	primary key (invoice, credat, cretim, creatr)
);

declare @sunot1 table (
	CUSTMR varchar(7) not NULL,
	CREDAT date not NULL,
	CRETIM varchar(6) not NULL,
	CREATR varchar(10) not NULL,
	NOTTEX varchar(8000) NULL,
	MODDAT date NULL,
	MODTIM varchar(6) NULL,
	MODIFR varchar(10) NULL,
	primary key (custmr, credat, cretim, creatr)
);

declare @terms table (
	TERMS varchar(6) NULL,
	TERMSDES varchar(15) NULL
);

declare @invoiceBalances table (
	CUSTMR varchar(7) not NULL,
	INVOICE char(7) not NULL,
	BALANCE numeric(10, 2) NULL,
	primary key (custmr, invoice)
);

declare @excludedCustomers table (
	custmr varchar(7) primary key not null,
	cusnam varchar(30) not null,
	itemCount smallint not null,
	itemSum numeric (11,2) not null,
	money_on_account numeric(10, 2) not null
);

declare @excludedCustomersMoneyOnAccount table (
	custmr varchar(7) primary key not null,
	money_on_account numeric(10, 2) null
);

declare @excludedInvoices table (
	INVOICE char(7) primary key not NULL,
	exclude_reason varchar(100) not null,
	INVCDAT datetime NULL,
	SALORD char(6) NULL,
	DOCMNT varchar(8) NULL,
	CUSTMR varchar(7) NULL,
	CUSNAM varchar(30) NULL,
	ORDSOU char(1) NULL,
	CUSTMRPO varchar(12) NULL,
	ORDDAT datetime NULL,
	PAYOFF varchar(7) NULL,
	ARTOT numeric(10, 2) NULL,
	SALOFF char(2) NULL,
	sales_office_description varchar(30) null,
	invoice_balance numeric(10, 2) null
);

declare @other_invoicing_instructions table (
	custmr varchar(7) primary key not null
	, instructions varchar(226) not null --226 is double the field width of 113. since we replace pipe characte with char(13)+char(10) we double the width
);

declare @customersWithExcludes table (
	custmr varchar(7) primary key not null
);

declare @resultSet table (
	INVOICE char(7) primary key not NULL,
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
	notes varchar(8000) null,
	invoicing_instructions varchar(8000) null,
	invoicing_action varchar(100) null,
	has_excluded_invoices bit not null,
	unique_send_to_id smallint not null
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
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS
	, ltrim(rtrim(EMLINVCON)) as EMLINVCON
	, ltrim(rtrim(I_EMAIL)) as I_EMAIL
	, SENINV
	, ltrim(rtrim(CONTACT)) as CONTACT
	, ltrim(rtrim(FIRLAS)) as FIRLAS
	, ltrim(rtrim(JOBTIT)) as JOBTIT
	, ltrim(rtrim(T_EMAIL)) as T_EMAIL
	, ltrim(rtrim(U_VOUCHER_REQUIRED)) as U_VOUCHER_REQUIRED
	, ltrim(rtrim(U_MAILING_ADDRESS_IN_NOTES)) as U_MAILING_ADDRESS_IN_NOTES
	, ltrim(rtrim(U_SEND_0_BALANCE_INVOICES)) as U_SEND_0_BALANCE_INVOICES
	, ltrim(rtrim(U_OTHER_INVOICING_INSTRUCT)) as U_OTHER_INVOICING_INSTRUCT
	, ltrim(rtrim(U_EXCLUDE0BALANFROMDAILYREV)) as U_EXCLUDE0BALANFROMDAILYREV
	, ltrim(rtrim(U_ALWAYSEXCLUDEFROMDAILYREV)) as U_ALWAYSEXCLUDEFROMDAILYREV
from
	openquery (
		SZY_WinSol_ODBC, 
		''select
			i.INVOICE, i.INVCDAT, { fn ifnull(i.SALORD, '''''''')} as SALORD, { fn ifnull(i.DOCMNT, '''''''')} as DOCMNT
			, { fn ifnull(i.CUSTMR, '''''''')} as CUSTMR, { fn ifnull(c.CUSNAM, '''''''')} as CUSNAM, { fn ifnull(c.FAX, '''''''')} as FAX
			, { fn ifnull(i.SALREP, '''''''')} as SALREP, { fn ifnull(i.ORDSOU, '''''''')} as ORDSOU, { fn ifnull(i.INVTO, '''''''')} as INVTO
			, { fn ifnull(i.CUSTMRPO, '''''''')} as CUSTMRPO, i.ORDDAT, { fn ifnull(i.SHIPTO, '''''''')} as SHIPTO
			, { fn ifnull(i.PAYOFF, '''''''')} as PAYOFF, { fn ifnull(i.TERMS, '''''''')} as TERMS, i.ARTOT, i.SALES, i.COS, i.SUPCHA
			, { fn ifnull(i.SALOFF, '''''''')} as SALOFF, i.TAX, i.SASALES, i.SACOS, { fn ifnull(i.STATUS, '''''''')} as STATUS
			, { fn ifnull(c.EMLINVCON, '''''''')} as EMLINVCON, { fn ifnull(i.Z_EMAIL, '''''''')} as I_EMAIL, { fn ifnull(c.SENINV, '''''''')} as SENINV
			, { fn ifnull(t.CONTACT, '''''''')} as CONTACT, { fn ifnull(t.FIRLAS, '''''''')} as FIRLAS, { fn ifnull(t.JOBTIT, '''''''')} as JOBTIT
			, { fn ifnull(t.EMAIL, '''''''')} as T_EMAIL, { fn ifnull(c.U_VOUCHER_REQUIRED, ''''N'''')} as U_VOUCHER_REQUIRED
			, { fn ifnull(c.U_MAILING_ADDRESS_IN_NOTES, ''''N'''')} as U_MAILING_ADDRESS_IN_NOTES
			, { fn ifnull(c.U_SEND_0_BALANCE_INVOICES, ''''N'''')} as U_SEND_0_BALANCE_INVOICES
			, { fn ifnull(c.U_OTHER_INVOICING_INSTRUCT, '''''''')} as U_OTHER_INVOICING_INSTRUCT
			, { fn ifnull(c.U_EXCLUDE0BALANFROMDAILYREV, ''''N'''')} as U_EXCLUDE0BALANFROMDAILYREV
			, { fn ifnull(c.U_ALWAYSEXCLUDEFROMDAILYREV, ''''N'''')} as U_ALWAYSEXCLUDEFROMDAILYREV
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
	, CONTACT, FIRLAS, JOBTIT, T_EMAIL
	, U_VOUCHER_REQUIRED, U_MAILING_ADDRESS_IN_NOTES, U_SEND_0_BALANCE_INVOICES, U_OTHER_INVOICING_INSTRUCT, U_EXCLUDE0BALANFROMDAILYREV
	, U_ALWAYSEXCLUDEFROMDAILYREV)
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
			{ fn ifnull(f.CUSTMR, '''''''')} as CUSTMR, { fn ifnull(f.Z_EMAIL, '''''''')} as Z_EMAIL
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

insert into @customers
	(CUSTMR, CUSNAM, FAX, C_EMAIL, SENINV
	, VOUCHER_REQUIRED, MAILING_ADDRESS_IN_NOTES, SEND_0_BALANCE_INVOICES, OTHER_INVOICING_INSTRUCT, EXCLUDE_0_BALANCE, ALWAYS_EXCLUDE
	, EMLINVCON, customer_notes, money_on_account, account_balance, email_contacts, has_excluded_invoices)
select
	CUSTMR, CUSNAM, FAX, '', SENINV
	, case U_VOUCHER_REQUIRED when 'Y' then 1 else 0 end, case U_MAILING_ADDRESS_IN_NOTES when 'Y' then 1 else 0 end
	, case U_SEND_0_BALANCE_INVOICES when 'Y' then 1 else 0 end, U_OTHER_INVOICING_INSTRUCT
	, case U_EXCLUDE0BALANFROMDAILYREV when 'Y' then 1 else 0 end, case U_ALWAYSEXCLUDEFROMDAILYREV when 'Y' then 1 else 0 end
	, EMLINVCON, '', 0, 0, '', 0
from
	@invoices_customers_contacts
group by
	CUSTMR, CUSNAM, FAX, SENINV
	, case U_VOUCHER_REQUIRED when 'Y' then 1 else 0 end, case U_MAILING_ADDRESS_IN_NOTES when 'Y' then 1 else 0 end
	, case U_SEND_0_BALANCE_INVOICES when 'Y' then 1 else 0 end, U_OTHER_INVOICING_INSTRUCT
	, case U_EXCLUDE0BALANFROMDAILYREV when 'Y' then 1 else 0 end, case U_ALWAYSEXCLUDEFROMDAILYREV when 'Y' then 1 else 0 end
	, EMLINVCON;

insert into @invoices (INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL, invoice_notes, invoicing_instructions, unique_send_to_id)
select INVOICE, INVCDAT, SALORD, DOCMNT, CUSTMR, SALREP, ORDSOU, INVTO, CUSTMRPO, ORDDAT, SHIPTO, PAYOFF, TERMS
	, ARTOT, SALES, COS, SUPCHA, SALOFF, TAX, SASALES, SACOS, STATUS, I_EMAIL, '', '', 0
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
	on c.CUSTMR = f.CUSTMR;

delete @sucf;

update c
	set c.recent_invoices_count = i.ic
from
	@customers c
	inner join
	(
		select ii.CUSTMR, count(*) as ic from @invoices ii group by ii.CUSTMR
	) i
	on c.CUSTMR = i.CUSTMR;

update i
	set i.TERMSDES = t.TERMSDES
from
	@invoices i
	inner join
	@terms t
	on i.TERMS = t.TERMS;

--sales office names are in SAB, but i dont like the names there so i am using my own
update @invoices set sales_office_description = 
	case SALOFF 
		when '01' then 'SZY'
		when '02' then 'Ever Ready'
		when '03' then 'Dixie EMS'
		when '04' then 'BP Medical'
		when '05' then 'Amazon Fulfillment'
		else 'Unknown' end;

delete @invoices_customers_contacts;


--get rid off all invoices for which we dont need any more info (basically those being excluded) before we query point
--force again, and once we are doing it early then we might as well do it before we do any cursors

--remove deleted invoices. do this first since we dont consider them to exist, with the exception that we need to know is if in50 will print them
--so we first set @customers.has_excluded_invoices
update c set has_excluded_invoices = 1
from @customers c inner join @invoices i on c.CUSTMR = i.CUSTMR
where i.DOCMNT = 'DELET';
delete @invoices where DOCMNT = 'DELET';
delete c from @customers c where not exists (select 1 from @invoices i where c.CUSTMR = i.CUSTMR);

--dump excluded customers to excludedCustomers table and remove from @customers and @invoices tables
insert into @excludedCustomers (custmr, cusnam, itemCount, itemSum, money_on_account)
select
	c.CUSTMR, c.CUSNAM, count(*) as itemCount, sum(i.ARTOT) as itemSum, 0
from
	@customers c inner join @invoices i on c.CUSTMR = i.CUSTMR
where
	c.ALWAYS_EXCLUDE = 1
group by
	c.CUSTMR, c.CUSNAM;
delete i from @invoices i where exists (select 1 from @excludedCustomers e where i.CUSTMR = e.custmr);

declare excluded_customers_money_on_account_cursor cursor for
	select custmr
	from @excludedCustomers;

set @cc = null;

print 'A MONEYOA excluded customers: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open excluded_customers_money_on_account_cursor;

fetch next from excluded_customers_money_on_account_cursor into @cc;

while @@FETCH_STATUS = 0
begin
	/* version of code for odbc driver version 6. this version for code should also work with dirver version 5 but it isnt for most users
	-- but is working for me. its very strange but thats what i find.
	set @sql =
	'select
		''' + @cc + ''' as CUSTMR
		, case RECORD_COUNT when 0 then null else MONEY_ON_ACCOUNT end as MONEY_ON_ACCOUNT
	from
		openquery (
			SZY_WinSol_ODBC, 
			''select
				{ fn ifnull(sum(a.INVCAMT + a.TOTPAY), 0)} as MONEY_ON_ACCOUNT
				, count(*) as RECORD_COUNT
			from
				arar a
			where
				a.CUSTMR = ''''' + @cc + '''''
				and a.INVCAMT + a.TOTPAY < 0
		'')';
	--*/

	--/* version of code for odbc driver version 5.1, overcomes error of pxplus odbc driver cant do order by which
	-- occurs for some users but not me.
	set @sql =
	'select
		''' + @cc + ''' as CUSTMR
		, sum(INVCAMT + TOTPAY) as MONEY_ON_ACCOUNT
	from
		openquery (
			SZY_WinSol_ODBC, 
			''select
				a.INVCAMT, a.TOTPAY
			from
				arar a
			where
				a.CUSTMR = ''''' + @cc + '''''
				and a.INVCAMT + a.TOTPAY < 0
		'')';
	--*/

	insert into @excludedCustomersMoneyOnAccount exec (@sql);

	fetch next from excluded_customers_money_on_account_cursor into @cc;
end

close excluded_customers_money_on_account_cursor;
deallocate excluded_customers_money_on_account_cursor;

print 'Z MONEYOA excluded customers: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

update ec set
	ec.money_on_account = ecm.money_on_account
from
	@excludedCustomers ec
	inner join
	@excludedCustomersMoneyOnAccount ecm
	on ec.custmr = ecm.custmr
where
	ecm.money_on_account is not null;

--remove credit notes (balance will be gathered later for efficiency reasons)
insert into @excludedInvoices
	(CUSTMR, CUSNAM, INVOICE
	, exclude_reason
	, INVCDAT, SALORD, DOCMNT, ORDSOU, CUSTMRPO, ORDDAT, PAYOFF, ARTOT, SALOFF, sales_office_description)
select
	c.CUSTMR, c.CUSNAM, i.INVOICE
	, @excludeReasonCreditNote
	, i.INVCDAT, i.SALORD, i.DOCMNT, i.ORDSOU, i.CUSTMRPO, i.ORDDAT, i.PAYOFF, i.ARTOT, i.SALOFF, i.sales_office_description
from @invoices i inner join @customers c on i.custmr = c.custmr
where i.DOCMNT = 'NOTES';
delete i from @invoices i inner join @excludedInvoices e on i.INVOICE = e.INVOICE;

--remove all @customers that dont have any @invoices left before doing cursor
delete c from @customers c where not exists (select 1 from @invoices i where c.CUSTMR = i.custmr);

--run the invoice_balance_cursor after removing all customers that dont need balance info (e.g. excluded customers, customers that had no items
--left after removing items that need to be removed).
--invoice_balance_cursor is used primarily to get the money_on_account and customer_balance values. it is also used as a first attempt
--to get the invoice balance, it will find this value (by getting invoices by customer) if the payoff is the same as customer
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
				{ fn ifnull(a.INVOICE, '''''''')} as INVOICE, { fn ifnull(a.INVCAMT, 0)} + { fn ifnull(a.TOTPAY, 0)} as BALANCE
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

--add balance info for rare cases where payoff <> custmr and for credit notes (customer will have been removed from @customers if nothing was
--left after removing credit notes).
--about the table keys: this cursor looks up balances for invoices. the primary key of an invoice is the invoice number and therefore to look
--it up in the arar table we should only need to use the invoice number as the key, since any item in the arar table with an "invoice" number
--that is used multiple times must be a non invoice item. the only reason we use the payor is for performance reasons, it speeds up the query
declare invoice_balance_by_invoice_cursor cursor static for
	select i.PAYOFF, i.INVOICE
	from @invoices i
	where
		not exists (select 1 from @invoiceBalances ib where i.INVOICE = ib.INVOICE)
		and i.CUSTMR <> i.PAYOFF --this condition excludes items that would have already been found by the previous cursor had they existed
	union
	select e.PAYOFF, e.INVOICE
	from @excludedInvoices e
	where not exists (select 1 from @invoiceBalances ib where e.INVOICE = ib.INVOICE);

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
				{ fn ifnull(a.CUSTMR, '''''''')} as CUSTMR, { fn ifnull(a.INVCAMT, 0)} + { fn ifnull(a.TOTPAY, 0)} as BALANCE
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

--we join by invoices only without the payor since we are joining to the invoice table which has field invoice as the primary key
--which means it could have only one corresponding record in arar. any "invoice" in arar with multiple records is not an invoice
--and won't be in inih.
update i
	set i.invoice_balance = isnull(b.BALANCE, 0)
from
	@invoices i
	left join
	@invoiceBalances b
	on i.INVOICE = b.INVOICE;

--add balance info for items previously added to @excludedInvoices (current example is credit notes)
--we join by invoices only without the payor since we are joining to the invoice table which has field invoice as the primary key
--which means it could have only one corresponding record in arar. any "invoice" in arar with multiple records is not an invoice
--and won't be in inih.
update e
	set e.invoice_balance = isnull(b.BALANCE, 0)
from
	@excludedInvoices e
	left join
	@invoiceBalances b
	on e.INVOICE = b.INVOICE;

--remove 0 balance excludes
insert into @excludedInvoices
	(CUSTMR, CUSNAM, INVOICE
	, exclude_reason
	, INVCDAT, SALORD, DOCMNT, ORDSOU, CUSTMRPO, ORDDAT, PAYOFF, ARTOT, SALOFF, sales_office_description, invoice_balance)
select
	c.CUSTMR, c.CUSNAM, i.INVOICE
	, @excludeReason0Balance
	, i.INVCDAT, i.SALORD, i.DOCMNT, i.ORDSOU, i.CUSTMRPO, i.ORDDAT, i.PAYOFF, i.ARTOT, i.SALOFF, i.sales_office_description, i.invoice_balance
from @customers c inner join @invoices i on c.CUSTMR = i.CUSTMR
where c.EXCLUDE_0_BALANCE = 1 and i.invoice_balance = 0;
delete i from @invoices i inner join @excludedInvoices e on i.INVOICE = e.INVOICE;

--remove dixie and bp website orders that are fully paid
insert into @excludedInvoices
	(CUSTMR, CUSNAM, INVOICE
	, exclude_reason
	, INVCDAT, SALORD, DOCMNT, ORDSOU, CUSTMRPO, ORDDAT, PAYOFF, ARTOT, SALOFF, sales_office_description, invoice_balance)
select
	c.CUSTMR, c.CUSNAM, i.INVOICE
	, @excludeReasonPaidWebsiteOrder
	, i.INVCDAT, i.SALORD, i.DOCMNT, i.ORDSOU, i.CUSTMRPO, i.ORDDAT, i.PAYOFF, i.ARTOT, i.SALOFF, i.sales_office_description, i.invoice_balance
from @invoices i inner join @customers c on i.CUSTMR = c.CUSTMR
where i.ORDSOU in ('B','D') and i.invoice_balance = 0;
delete i from @invoices i inner join @excludedInvoices e on i.INVOICE = e.INVOICE;

--final clean up of all excludes:
delete c from @customers c where not exists (select 1 from @invoices i where c.CUSTMR = i.custmr);
update c set has_excluded_invoices = 1 from @customers c where exists (select 1 from @excludedInvoices e where c.CUSTMR = e.CUSTMR);
delete t from @contacts t where not exists (select 1 from @customers c where c.CUSTMR = t.custmr);

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

update @customers set email_contacts = dbo.cleanLineBreaks(email_contacts);

print 'A INNOT1: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--not joining to inih because it slows the query down in this case, even though we are using keys
--NOTE: i did not enclose NOTTEX below in an ifnull becuase the odbc gives an error. this probably
--has to do with the fact that the field length is 8000. instead, i filtered the query with is not null
insert into @innot1
	(INVOICE, CREDAT, CRETIM, CREATR, NOTTEX, MODDAT, MODTIM, MODIFR)
select
	a.INVOICE, a.CREDAT, a.CRETIM, a.CREATR, a.NOTTEX, a.MODDAT, a.MODTIM, a.MODIFR
from
	openquery (
		SZY_WinSol_ODBC, 
		'select
			{ fn ifnull(INVOICE, '''')} as INVOICE, CREDAT, { fn ifnull(CRETIM, '''')} as CRETIM, { fn ifnull(CREATR, '''')} as CREATR
			, NOTTEX, MODDAT, { fn ifnull(MODTIM, '''')} as MODTIM, { fn ifnull(MODIFR, '''')} as MODIFR
		from innot1
		where NOTTEX is not null'
	) a
where
	exists (select i.INVOICE from @invoices i where i.INVOICE = a.INVOICE);

print 'Z INNOT1: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

print 'A SUNOT1: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

--not joining to inih because it slows the query down in this case, even though we are using keys
--NOTE: i did not enclose NOTTEX below in an ifnull becuase the odbc gives an error. this probably
--has to do with the fact that the field length is 8000. instead, i filtered the query with is not null
insert into @sunot1
	(CUSTMR, CREDAT, CRETIM, CREATR, NOTTEX, MODDAT, MODTIM, MODIFR)
select
	a.CUSTMR, a.CREDAT, a.CRETIM, a.CREATR, a.NOTTEX, a.MODDAT, a.MODTIM, a.MODIFR
from
	openquery (
		SZY_WinSol_ODBC, 
		'select
			{ fn ifnull(CUSTMR, '''')} as CUSTMR, CREDAT, { fn ifnull(CRETIM, '''')} as CRETIM, { fn ifnull(CREATR, '''')} as CREATR
			, NOTTEX, MODDAT, { fn ifnull(MODTIM, '''')} as MODTIM, { fn ifnull(MODIFR, '''')} as MODIFR
		from sunot1
		where NOTTEX is not null'
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

insert into @other_invoicing_instructions (custmr, instructions)
select c.CUSTMR, dbo.cleanLineBreaks(ltrim(rtrim(REPLACE(c.OTHER_INVOICING_INSTRUCT, '|', char(10)))))
from @customers c;

--SENINV values are static so i am not concerned about new values
--char(10) (without char(13)) is used since we will need to do a dbo.cleanLineBreaks later anyway
update i set i.invoicing_instructions =
	case c.SENINV
		when 'H' then 'Don''t Send this Invoice (Hold)'
		else
			case when c.SEND_0_BALANCE_INVOICES = 0 and i.invoice_balance = 0 then 'Don''t Send this Invoice (0 Balance)' + char(10) else '' end
			+ case o.instructions
				when '' then ''
				else @instruction +  replace(o.instructions, char(13) + char(10), char(13) + char(10) + @instruction) + char(10)
			end
			+ case c.VOUCHER_REQUIRED when 1 then 'Voucher Required' + char(10) else '' end
			+
			case c.MAILING_ADDRESS_IN_NOTES
				when 1 then
					case c.SENINV
						when 'M' then @invoiceToPrefix + 'Regular Mail to Address in Notes' + char(10) + c.customer_notes
						else 'Error: Mail to address in notes is specified but invoicing action is not Mail' + char(10)
					end
				else
					case c.SENINV
						when 'S' then ''
						when 'M' then @invoiceToPrefix + 'Regular Mail'
						when 'F' then @invoiceToPrefix + 'Fax - ' + case len(c.FAX) when 0 then 'fax number is missing or is not valid' else c.FAX + @iFaxDomain end
						--next clause needs to handle blank email addresses since point force allows user to set "send invoice to" to an email contact that does
						--not have an email address, and also i dont trust it to maintain referential integrity regarding deletes of existing contact email addresses
						when 'E' then @invoiceToPrefix + case isnull(t.T_EMAIL, '') when '' then 'Email, email address is missing' else t.T_EMAIL end
					end
			end
	end
from
	@customers c
	inner join @invoices i on c.CUSTMR = i.CUSTMR
	inner join @other_invoicing_instructions o on c.CUSTMR = o.custmr
	left join @contacts t on c.EMLINVCON = t.CONTACT;

declare invoice_count_cursor cursor static for
	select c.CUSTMR
	from @customers c
	where c.SENINV = 'S' and isnull(c.recent_invoices_count, 0) < @frequentInvoicesThreshold;

set @cc = null;

print 'A INVOICE COUNT: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

open invoice_count_cursor;

fetch next from invoice_count_cursor into @cc;

while @@FETCH_STATUS = 0
begin


	set @sql =
		'select @xcic = count(*)
		from openquery(szy_winsol_odbc,	''
			select
				i.INVOICE
			from
				inih i
			where
				i.custmr = ''''' + @cc + '''''
				and i.invcdat > {d ''''' + convert(char(10), dateadd(D, -(@daysConsideredRecent + 1), @date), 120) + ''''' }
		'')'
	
	exec sp_executesql @sql, N'@xcic int OUTPUT', @cic OUTPUT;

	update @customers set recent_invoices_count = isnull(@cic, 0) where CUSTMR = @cc;

	fetch next from invoice_count_cursor into @cc;
end

print 'Z INVOICE COUNT: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

close invoice_count_cursor;
deallocate invoice_count_cursor;

--we rely on the previous setting of @invoices.invoicing_instructions to have left a line break at the end of all @customers.SENINV = 'S'
update i set i.invoicing_instructions =
		i.invoicing_instructions
		+ case when c.recent_invoices_count >= @frequentInvoicesThreshold then 'SET UP ACCOUNTS PAYABLE' + char(10) else '' end
		+ c.customer_notes + char(10)
		+ case c.C_EMAIL when '' then '' else  @customerEmailDescription + c.C_EMAIL end + char(10)
		+ case i.I_EMAIL when '' then ''
			else case when i.I_EMAIL = c.C_EMAIL then '' else @invoiceEmailDescription + i.I_EMAIL end
		  end + char(10)
		+ case c.email_contacts when '' then '' else  @customerContactsDescription + c.email_contacts end + char(10)
from
	@invoices i inner join @customers c on i.CUSTMR = c.CUSTMR
where
	c.SENINV = 'S';

update @invoices set invoicing_instructions = dbo.cleanLineBreaks(invoicing_instructions);


--assign a unique invoice destination id, unique per customer + invoice
--an invoice destination means where the invoice is sent, if sucu.seninv is email/fax the it is always 1
--destination, if regular mail the it depends on the inih.invto + nothing (for s), or payoff (for p), or shipto (for r)
update i set
	i.unique_send_to_id = dids.destination_id
from
	@customers c
	inner join
	@invoices i
	on c.CUSTMR = i.CUSTMR
	inner join
	(
		select
			c.CUSTMR
			, case when c.SENINV in ('S', 'M') then 1 else 2 end as seninv_value
			, case when c.SENINV in ('S', 'M') then i.INVTO else '' end as invto_value
			, case when c.SENINV in ('S', 'M') then
				case i.INVTO when 'R' then i.SHIPTO when 'P' then i.PAYOFF else '' end
				else '' end as othercode_value
			, ROW_NUMBER() over (partition by c.custmr order by c.custmr) as destination_id
		from
			@customers c
			inner join
			@invoices i
			on c.CUSTMR = i.CUSTMR
		group by
			c.CUSTMR
			, case when c.SENINV in ('S', 'M') then 1 else 2 end
			, case when c.SENINV in ('S', 'M') then i.INVTO else '' end
			, case when c.SENINV in ('S', 'M') then case i.INVTO when 'R' then i.SHIPTO when 'P' then i.PAYOFF else '' end else '' end
	) dids
	on c.CUSTMR = dids.CUSTMR
	and case when c.SENINV in ('S', 'M') then 1 else 2 end = dids.seninv_value
	and case when c.SENINV in ('S', 'M') then i.INVTO else '' end = dids.invto_value
	and case when c.SENINV in ('S', 'M') then 
		case i.INVTO when 'R' then i.SHIPTO when 'P' then i.PAYOFF else '' end 
		else '' end = dids.othercode_value

insert into @resultSet
(
	INVOICE, SALORD, CUSTMR, CUSNAM, CUSTMRPO, TERMSDES, ARTOT, SALOFF, sales_office_description, invoice_balance, unique_send_to_id
	, invoicing_instructions
	, notes
	, money_on_account
	, invoicing_action
	, has_excluded_invoices
)
select
	i.INVOICE, i.SALORD, i.CUSTMR, c.CUSNAM, i.CUSTMRPO, i.TERMSDES, i.ARTOT, i.SALOFF, i.sales_office_description
	, i.invoice_balance, i.unique_send_to_id
	, i.invoicing_instructions
	, case len(left(c.customer_notes, 1) + left(i.invoice_notes, 1))
		when 2 then i.invoice_notes + char(13) + char(10) + c.customer_notes
		else i.invoice_notes + c.customer_notes
		end
	, - c.money_on_account as money_on_account
	, case c.SENINV
		when 'H' then @excludeString
		else
			case when c.SEND_0_BALANCE_INVOICES = 0 and i.invoice_balance = 0 then @excludeString else '' end
	end as invoicing_action
	, c.has_excluded_invoices
from
	@invoices i inner join @customers c on i.CUSTMR = c.CUSTMR;

insert into @customersWithExcludes (custmr)
select CUSTMR
from @resultSet
where has_excluded_invoices = 1
group by CUSTMR;

--return results
--the order or returned recordsets matters, it must match the order that the vba in excel expects it

--unique_send_to_ids
select INVOICE, unique_send_to_id
from @resultSet
order by SALOFF, CUSTMR, INVOICE;

--@customersWithExcludes
select custmr
from @customersWithExcludes
order by custmr;

--invoices to process:
select
	r.CUSTMR as Customer
	, r.CUSNAM as Name
	, r.invoicing_instructions as [Invoicing Instructions]
	, r.INVOICE as Invoice
	, r.invoicing_action as [Invoicing Action]
	, '' as Charge
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
	r.SALOFF, r.CUSTMR, r.INVOICE;

--@excludedInvoices all others
select exclude_reason as [Exclude Reason], count(*) as Invoices, sum(ARTOT) as Total, sum(invoice_balance) as Balance
from @excludedInvoices
where exclude_reason <> @excludeReasonCreditNote
group by exclude_reason
order by exclude_reason;

--@excludedCustomers
select custmr as Customer, cusnam as Name, itemCount as [Invoices/Credits], itemSum as Total, money_on_account as [Money on Account]
from @excludedCustomers
order by custmr;

--@excludedInvoices.exclude_reason = @excludeReasonCreditNote
select
	CUSTMR as Customer, CUSNAM as Name, INVOICE as Invoice, ARTOT as Total, invoice_balance as Balance, SALORD as [Sales Order], CUSTMRPO as [PO Number]
from @excludedInvoices
where exclude_reason = @excludeReasonCreditNote
order by SALOFF, CUSTMR, INVOICE;

print 'END: ' + convert(varchar(100), CURRENT_TIMESTAMP, 121);

return;

-- end real section */
