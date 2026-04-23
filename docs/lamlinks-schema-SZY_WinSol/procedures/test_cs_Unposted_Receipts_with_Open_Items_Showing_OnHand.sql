-- dbo.test_cs_Unposted_Receipts_with_Open_Items_Showing_OnHand


CREATE     PROCEDURE [dbo].[test_cs_Unposted_Receipts_with_Open_Items_Showing_OnHand]

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

insert into @pos select SUPPLR, SUPPLRDES from openquery(CS_SZY_WINSOL_ODBC, 'SELECT SUPPLR, { fn CONCAT(SUPPLRDES, '''')} as SUPPLRDES FROM POS')

insert into @popr select RECPT, SUPPLR, PACSLI from openquery(CS_SZY_WINSOL_ODBC, 'SELECT RECPT, SUPPLR, { fn CONCAT(PACSLI, '''')} as PACSLI FROM POPR')

insert into @poprd select RECPT, PRODCT, RECQTY from openquery(CS_SZY_WINSOL_ODBC, 'SELECT RECPT, ifnull(PRODCT,'''') PRODCT, RECQTY FROM POPRD')

insert into @ici1 select PRODCT, PRODCTDES from openquery(CS_SZY_WINSOL_ODBC, 'SELECT DISTINCT ICI1.PRODCT, { fn CONCAT(PRODCTDES, '''')} as PRODCTDES
								FROM ICI1, POPRD where ICI1.PRODCT = POPRD.PRODCT')

insert into @icwm select PRODCT, ONHQTY from openquery(CS_SZY_WINSOL_ODBC, 'SELECT ifnull(ICWM.PRODCT,'''') PRODCT, sum(ONHQTY) as ONHQTY
								FROM ICWM, POPRD where ICWM.PRODCT = POPRD.PRODCT GROUP BY ICWM.PRODCT')

insert into @oeoo_1 select SALORD, CUSTMR, CUSTMRPO from openquery(CS_SZY_WINSOL_ODBC, 'SELECT SALORD, CUSTMR, 
								ifnull(CONCAT(CUSTMRPO, ''''), '''') as CUSTMRPO FROM OEOO_1')

insert into @oeoo_2 select SALORD, ORDDAT, STATUS, PROTECT, ORDSOU, SALOFF from openquery(CS_SZY_WINSOL_ODBC,
								'SELECT SALORD, ORDDAT, ifnull(CONCAT(STATUS, ''''), '''') as STATUS, ifnull(PROTECT, '''') PROTECT, ORDSOU, 
								{ fn CONCAT(SALOFF, '''')} as SALOFF FROM OEOO_2')

insert into @oeoo_p select SALORD, PRODCT, SHIQTY, BOQTY from openquery(CS_SZY_WINSOL_ODBC, 'SELECT SALORD, PRODCT, SHIQTY, BOQTY FROM OEOO_P')


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

