-- dbo.AR30_Batches


CREATE proc [dbo].[AR30_Batches]
as
set nocount on;

declare @b table (
	[BATCHTOT] [numeric](11, 2) NULL,
	[BATCH] [varchar](6) NULL,
	[USERID] [varchar](10) NULL,
	[CREDTE] [date] NULL,
	[CHEQUE] [varchar](8) NULL,
	[CHEAMT] [numeric](9, 2) NULL,
	[PAYCUSTMR] [varchar](7) NULL,
	[LINE] [varchar](4) NULL,
	[CUSTMR] [varchar](7) NULL,
	[CUSNAM] [VARCHAR] (30) NULL,
	[REFRNC] [varchar](7) NULL,
	[REFDAT] [date] NULL,
	[PAYTRA] [varchar](2) NULL,
	[APPAMT] [numeric](9, 2) NULL,
	[GLACCT] [varchar](8) NULL,
	[COMMENT] [varchar](30) NULL,
	[GLENTRY] [varchar](50),
	[OPENBALANCE] [numeric](9, 2) NULL
)

insert into @b (
	BATCHTOT, BATCH, USERID, CREDTE
	, CHEQUE, CHEAMT, PAYCUSTMR
	, LINE, CUSTMR, REFRNC, REFDAT, PAYTRA, APPAMT, GLACCT, COMMENT
)
select
	a.BATCHTOT, a.BATCH, a.USERID, a.CREDTE
	, a.CHEQUE, a.CHEAMT, a.PAYCUSTMR
	, a.LINE, a.CUSTMR, a.REFRNC, a.REFDAT, a.PAYTRA, a.APPAMT, a.GLACCT, a.COMMENT
from
	openquery(SZY_WinSol_ODBC, 
		'SELECT
			B.BATCHTOT, { fn ifnull(B.BATCH, '''')} as BATCH, { fn ifnull(B.USERID, '''')} as USERID, B.CREDTE
			, { fn ifnull(H.CHEQUE, '''')} as CHEQUE, H.CHEAMT, { fn ifnull(H.PAYCUSTMR, '''')} as PAYCUSTMR
			, { fn ifnull(D.LINE, '''')} as LINE, { fn ifnull(D.CUSTMR, '''')} as CUSTMR, { fn ifnull(D.REFRNC, '''')} as REFRNC
			, D.REFDAT, { fn ifnull(D.PAYTRA, '''')} as PAYTRA, D.APPAMT, { fn ifnull(D.GLACCT, '''')} as GLACCT
			, { fn ifnull(D.COMMENT, '''')} as COMMENT
		FROM
			SYBA B, ARCRD D, ARCR H
		WHERE
			(B.PROID=''AR30'') AND (B.BATCH=H.BATCH) AND (H.BATCH=D.BATCH) AND (H.PAYCUSTMR=D.PAYCUSTMR) AND (H.CHEQUE=D.CHEQUE)'
	) a

update b
	set GLENTRY =
		case
			when ltrim(rtrim(isnull(b.GLACCT, ''))) = ''
			then rtrim(isnull(b.COMMENT, ''))
			else rtrim(rtrim(b.GLACCT) + ' ' + rtrim(isnull(b.COMMENT, '')))
		end
from
	@b b

declare @names table(customer varchar(7), name varchar(30))

insert into @names (customer, name)
select CUSTMR, CUSNAM
from openquery(SZY_WinSol_ODBC,
		'SELECT
			{ fn ifnull(D.CUSTMR, '''')} as CUSTMR, { fn ifnull(C.CUSNAM, '''')} as CUSNAM
		FROM
			ARCRD D, SUCU C
		WHERE
			D.CUSTMR = C.CUSTMR'
)
group by
	CUSTMR, CUSNAM

update b
	set b.CUSNAM = n.name
from
	@b b
	inner join
	@names n
	on b.CUSTMR = n.customer

declare @balances table (customer varchar(7), invoice varchar(7), balance numeric (9, 2))

insert into @balances (customer, invoice, balance)
select CUSTMR, REFRNC, BALANCE
from openquery(SZY_WinSol_ODBC,
		'SELECT
			{ fn ifnull(D.CUSTMR, '''')} as CUSTMR, { fn ifnull(D.REFRNC, '''')} as REFRNC
			, A.INVCAMT + A.TOTPAY as BALANCE
		FROM
			ARCRD D, ARAR A
		WHERE
			D.CUSTMR = A.CUSTMR AND D.REFRNC = A.INVOICE'
)
group by
	CUSTMR, REFRNC, BALANCE

update b
	set b.OPENBALANCE = ob.balance
from
	@b b
	inner join
	@balances ob
	on b.CUSTMR = ob.customer and b.REFRNC = ob.invoice

select
	a.BATCHTOT, a.BATCH, a.USERID, a.CREDTE, a.CHEQUE, a.CHEAMT, a.PAYCUSTMR
	, a.LINE, a.CUSTMR, a.CUSNAM, a.REFRNC, a.REFDAT, a.PAYTRA, a.APPAMT, a.GLACCT, a.COMMENT, a.GLENTRY
	, a.OPENBALANCE
from
	@b a
order by
	a.BATCHTOT, a.BATCH, a.PAYCUSTMR, a.CHEQUE, a.LINE
