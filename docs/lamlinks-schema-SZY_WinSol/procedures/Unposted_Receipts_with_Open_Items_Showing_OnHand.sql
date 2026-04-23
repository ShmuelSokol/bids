-- dbo.Unposted_Receipts_with_Open_Items_Showing_OnHand


CREATE     PROCEDURE [dbo].[Unposted_Receipts_with_Open_Items_Showing_OnHand]

AS

declare @ici1 TABLE ([PRODCT] [varchar](20) NULL, [PRODCTDES] [varchar](35) NULL)
declare @icwm table ([PRODCT] [varchar](20) NULL, [ONHQTY] [numeric](8, 0) NULL)
declare @oeoo_1 table ([SALORD] [varchar](6) NULL, [CUSTMR] [varchar](7) NULL, [CUSTMRPO] [varchar](12) NULL)
declare @oeoo_2 table ([SALORD] [varchar](6) NULL, [ORDDAT] [date] NULL, [STATUS] [varchar](6) NULL, 
	[PROTECT] [varchar](7) NULL, [ORDSOU] [varchar](1) NULL, [SALOFF] [varchar](2) NULL)
declare @oeoo_p table ([SALORD] [varchar](6) NULL, [PRODCT] [varchar](20) NULL, [SHIQTY] [numeric](10, 2) NULL,
	[BOQTY] [numeric](10, 2) NULL)
declare @popr table ([RECPT] [varchar](5) NULL, [SUPPLR] [varchar](6) NULL, [PACSLI] [varchar](15) NULL)
declare @poprd table ([RECPT] [varchar](5) NULL, [PRODCT] [varchar](20) NULL, [RECQTY] [numeric](9, 2) NULL)
declare @pos table ([SUPPLR] [varchar](6) NULL, [SUPPLRDES] [varchar](40) NULL)

insert into @pos select SUPPLR, SUPPLRDES from openquery(SZY_WINSOL_ODBC, '
	SELECT { fn ifnull(SUPPLR, '''')} as SUPPLR, { fn CONCAT({ fn ifnull(SUPPLRDES, '''')}, '''')} as SUPPLRDES FROM POS
')

insert into @popr select RECPT, SUPPLR, PACSLI from openquery(SZY_WINSOL_ODBC, '
	SELECT { fn ifnull(RECPT, '''')} as RECPT, { fn ifnull(SUPPLR, '''')} as SUPPLR
		, { fn CONCAT({ fn ifnull(PACSLI, '''')}, '''')} as PACSLI
	FROM POPR
')

insert into @poprd select RECPT, PRODCT, RECQTY from openquery(SZY_WINSOL_ODBC, '
	SELECT { fn ifnull(RECPT, '''')} as RECPT, { fn ifnull(PRODCT, '''')} as PRODCT, RECQTY FROM POPRD
')

insert into @ici1 select DISTINCT PRODCT, PRODCTDES from openquery(SZY_WINSOL_ODBC, '
	SELECT { fn ifnull(ICI1.PRODCT, '''')} as PRODCT, { fn CONCAT({ fn ifnull(PRODCTDES, '''')}, '''')} as PRODCTDES
	FROM ICI1, POPRD where ICI1.PRODCT = POPRD.PRODCT
')

--not enclosing in a ifnull because i cant use a function in the group by clause and though the query runs
--even without the ifnull in the group by i am uncomfortable with this. instead i added an is not null condition
insert into @icwm select PRODCT, sum(ONHQTY) as ONHQTY from openquery(SZY_WINSOL_ODBC, '
	SELECT ICWM.PRODCT, ONHQTY
	FROM ICWM, POPRD where ICWM.PRODCT = POPRD.PRODCT and ICWM.PRODCT is not null
')
Group by PRODCT;

insert into @oeoo_1 select SALORD, CUSTMR, CUSTMRPO from openquery(SZY_WINSOL_ODBC, '
	SELECT { fn ifnull(SALORD, '''')} as SALORD, { fn ifnull(CUSTMR, '''')} as CUSTMR
		, { fn CONCAT({ fn ifnull(CUSTMRPO, '''')}, '''')} as CUSTMRPO
	FROM OEOO_1
')

insert into @oeoo_2 select SALORD, ORDDAT, STATUS, PROTECT, ORDSOU, SALOFF from openquery(SZY_WINSOL_ODBC, '
	SELECT { fn ifnull(SALORD, '''')} as SALORD, ORDDAT, { fn CONCAT({ fn ifnull(STATUS, '''')}, '''')} as STATUS
		, { fn ifnull(PROTECT, '''')} as PROTECT, { fn ifnull(ORDSOU, '''')} as ORDSOU
		, { fn CONCAT({ fn ifnull(SALOFF, '''')}, '''')} as SALOFF
	FROM OEOO_2
')

insert into @oeoo_p select SALORD, PRODCT, SHIQTY, BOQTY from openquery(SZY_WINSOL_ODBC, '
	SELECT { fn ifnull(SALORD, '''')} as SALORD, { fn ifnull(PRODCT, '''')} as PRODCT, SHIQTY, BOQTY
	FROM OEOO_P
')


SELECT A.RECPT, A.RECQTY, A.SUPPLR, A.PACSLI, tvICI1.PRODCTDES, tvICWM.ONHQTY,
	tvPOS.SUPPLRDES, tvOEOO_P.SALORD, tvICI1.PRODCT, tvOEOO_1.CUSTMR, tvOEOO_1.CUSTMRPO, tvOEOO_2.SALOFF,
	tvOEOO_2.PROTECT, tvOEOO_2.ORDSOU, tvOEOO_P.SHIQTY, tvOEOO_P.BOQTY, tvOEOO_2.ORDDAT, tvOEOO_2.STATUS, getdate() as Today
FROM   (SELECT innerPOPR.RECPT, PACSLI, SUM(RECQTY) AS RECQTY, SUPPLR, PRODCT
		FROM @POPR innerPOPR INNER JOIN  @POPRD innerPOPRD ON innerPOPR.RECPT= innerPOPRD.RECPT
		GROUP BY innerPOPR.RECPT, PACSLI, SUPPLR, PRODCT) AS A
	INNER JOIN @ICI1 tvICI1 ON tvICI1.PRODCT = A.PRODCT
	INNER JOIN @ICWM tvICWM ON tvICWM.PRODCT = A.PRODCT
	INNER JOIN @POS tvPOS ON A.SUPPLR = tvPOS.SUPPLR 
	INNER JOIN @OEOO_P tvOEOO_P ON A.PRODCT = tvOEOO_P.PRODCT
	INNER JOIN @OEOO_1 tvOEOO_1 ON tvOEOO_P.SALORD = tvOEOO_1.SALORD
	INNER JOIN @OEOO_2 tvOEOO_2 ON tvOEOO_1.SALORD = tvOEOO_2.SALORD
WHERE	isnull(tvOEOO_2.STATUS, '') <> 'QUOTE'
ORDER BY	A.RECPT, tvICI1.PRODCT, tvOEOO_P.SALORD


return

