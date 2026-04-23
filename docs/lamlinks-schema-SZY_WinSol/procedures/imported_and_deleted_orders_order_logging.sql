-- dbo.imported_and_deleted_orders_order_logging




CREATE    procedure imported_and_deleted_orders_order_logging

as

set NOCOUNT on

declare @mError int
declare @missing_count int

--got create tables sql statements from there as well

--import orders. oeoo_1 must be first
truncate table [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1]
select @mError = @@error
if @mError <> 0 return @mError
insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1] select * from openquery(szy_winsol_odbc, 'select { fn CONCAT(SALORD, '''')} as SALORD, { fn CONCAT(ZERPAD3, '''')} as ZERPAD3, { fn CONCAT(ZERPAD4, '''')} as ZERPAD4, { fn CONCAT(ZERPAD5, '''')} as ZERPAD5, { fn CONCAT(RECTYP, '''')} as RECTYP, { fn CONCAT(CUSTMR, '''')} as CUSTMR, { fn CONCAT(SALREP, '''')} as SALREP, { fn CONCAT(DOCMNT, '''')} as DOCMNT, { fn CONCAT(SHIVIA, '''')} as SHIVIA, { fn CONCAT(ORDSCH, '''')} as ORDSCH, { fn CONCAT(BOCOM, '''')} as BOCOM, { fn CONCAT(ACCBO, '''')} as ACCBO, { fn CONCAT(SHICOM, '''')} as SHICOM, { fn CONCAT(INVTO, '''')} as INVTO, { fn CONCAT(SITYP, '''')} as SITYP, LASLIN, { fn CONCAT(TAXLIC1, '''')} as TAXLIC1, { fn CONCAT(TAXLIC2, '''')} as TAXLIC2, { fn CONCAT(CUSTMRPO, '''')} as CUSTMRPO, { fn CONCAT(WHSE, '''')} as WHSE, { fn CONCAT(MANDOC, '''')} as MANDOC, CONTACT, { fn CONCAT(ECORD, '''')} as ECORD, { fn CONCAT(CLATRA, '''')} as CLATRA, { fn CONCAT(SALGRO, '''')} as SALGRO, { fn CONCAT(PROVNC, '''')} as PROVNC, { fn CONCAT(TERTRY, '''')} as TERTRY, { fn CONCAT(CURRNCY, '''')} as CURRNCY, { fn CONCAT(FLYELG, '''')} as FLYELG, { fn CONCAT(CQUELG, '''')} as CQUELG, { fn CONCAT(LEVTYP, '''')} as LEVTYP, PRILEV, { fn CONCAT(CONCON, '''')} as CONCON, { fn CONCAT(SPECON, '''')} as SPECON, { fn CONCAT(COMCON, '''')} as COMCON, { fn CONCAT(FLYCON, '''')} as FLYCON, { fn CONCAT(QTYCON, '''')} as QTYCON, { fn CONCAT(CONSPE, '''')} as CONSPE, { fn CONCAT(SPESPE, '''')} as SPESPE, { fn CONCAT(COMSPE, '''')} as COMSPE, { fn CONCAT(FLYSPE, '''')} as FLYSPE, { fn CONCAT(QTYSPE, '''')} as QTYSPE, { fn CONCAT(PAYOFF, '''')} as PAYOFF, { fn CONCAT(TRASHO, '''')} as TRASHO, { fn CONCAT(HELDBY, '''')} as HELDBY, { fn CONCAT(ORDTYP, '''')} as ORDTYP, { fn CONCAT(REORDR, '''')} as REORDR, { fn CONCAT(IMPORD, '''')} as IMPORD, { fn CONCAT(REVBY, '''')} as REVBY from oeoo_1')
select @mError = @@error
if @mError <> 0 return @mError

truncate table [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_P]
select @mError = @@error
if @mError <> 0 return @mError
--removed text "{ fn CONCAT(SUM, '''')} as SUM," from following statement
insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_P] select * from openquery(szy_winsol_odbc, 'select { fn CONCAT(SALORD, '''')} as SALORD, { fn CONCAT(LINE, '''')} as LINE, { fn CONCAT(ZERPAD2, '''')} as ZERPAD2, { fn CONCAT(ZERPAD1, '''')} as ZERPAD1, { fn CONCAT(RECTYP, '''')} as RECTYP, { fn CONCAT(SETPRODCT, '''')} as SETPRODCT, { fn CONCAT(PRODCT, '''')} as PRODCT, { fn CONCAT(INVTYP, '''')} as INVTYP, { fn CONCAT(LINSTA, '''')} as LINSTA, { fn CONCAT(PRIOVE, '''')} as PRIOVE, { fn CONCAT(SALTYP, '''')} as SALTYP, { fn CONCAT(DISCNTOVE, '''')} as DISCNTOVE, PERVAL, { fn CONCAT(UPDDEM, '''')} as UPDDEM, { fn CONCAT(UPDUNI, '''')} as UPDUNI, { fn CONCAT(UPDDOL, '''')} as UPDDOL, { fn CONCAT(UPDCOS, '''')} as UPDCOS, { fn CONCAT(UPDONH, '''')} as UPDONH, { fn CONCAT(WORORD, '''')} as WORORD, { fn CONCAT(CONSIGNMNT, '''')} as CONSIGNMNT, { fn CONCAT(SKUVAL, '''')} as SKUVAL, { fn CONCAT(TAT, '''')} as TAT, { fn CONCAT(PER, '''')} as PER, { fn CONCAT(PSTOVE, '''')} as PSTOVE, { fn CONCAT(GSTOVE, '''')} as GSTOVE, { fn CONCAT(COMOVE, '''')} as COMOVE, { fn CONCAT(CONBIL, '''')} as CONBIL, { fn CONCAT(PRIHOL, '''')} as PRIHOL, { fn CONCAT(INVC, '''')} as INVC, COMRAT, LISPRI, OPENQTY, ORDQTY, INVQTY, SHIQTY, BOQTY, CANQTY, COSOVE, REQDAT, { fn CONCAT(DISCNT, '''')} as DISCNT, { fn CONCAT(QTYBRE, '''')} as QTYBRE, { fn CONCAT(MODHEAD, '''')} as MODHEAD, { fn CONCAT(MODLASLIN, '''')} as MODLASLIN, { fn CONCAT(MODLASRES, '''')} as MODLASRES, { fn CONCAT(MODREF, '''')} as MODREF, { fn CONCAT(MODQUO, '''')} as MODQUO, { fn CONCAT(MODINVC, '''')} as MODINVC, { fn CONCAT(MODSLI, '''')} as MODSLI, { fn CONCAT(PRILIS, '''')} as PRILIS, { fn CONCAT(LOTCOM, '''')} as LOTCOM, { fn CONCAT(COMORD, '''')} as COMORD, { fn CONCAT(MASPRILIS, '''')} as MASPRILIS, { fn CONCAT(CUSPRODCT, '''')} as CUSPRODCT, { fn CONCAT(TEMBIN, '''')} as TEMBIN, { fn CONCAT(RMA, '''')} as RMA, { fn CONCAT(LINEXT, '''')} as LINEXT, ALLQTY, SUMVAL, { fn CONCAT(SERCAL, '''')} as SERCAL, { fn CONCAT(SERLIN, '''')} as SERLIN, { fn CONCAT(SERTRA, '''')} as SERTRA, { fn CONCAT(PROTAX, '''')} as PROTAX, { fn CONCAT(TAXGRO, '''')} as TAXGRO, { fn CONCAT(TAXOVE, '''')} as TAXOVE, MPLSELPRI, REPCST, { fn CONCAT(PRIMET, '''')} as PRIMET, { fn CONCAT(METVAL, '''')} as METVAL, QTYBRELVL, { fn CONCAT(SKU, '''')} as SKU, { fn CONCAT(CLASS, '''')} as CLASS, { fn CONCAT(COMPRO, '''')} as COMPRO, { fn CONCAT(PROLIN, '''')} as PROLIN, { fn CONCAT(PROGRO, '''')} as PROGRO, TICPRI, TICCST, { fn CONCAT(COMCOD, '''')} as COMCOD, REFPRI, { fn CONCAT(REFPRILIS, '''')} as REFPRILIS, { fn CONCAT(Z_SELCOD, '''')} as Z_SELCOD, Z_SELRAT, Z_SELQTY, Z_SELPRI from oeoo_p')
select @mError = @@error
if @mError <> 0 return @mError

truncate table [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_S]
select @mError = @@error
if @mError <> 0 return @mError
insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_S] select * from openquery(szy_winsol_odbc, 'select { fn CONCAT(SALORD, '''')} as SALORD, { fn CONCAT(LINE, '''')} as LINE, { fn CONCAT(SUPCHA, '''')} as SUPCHA, { fn CONCAT(SUPCHADES, '''')} as SUPCHADES, QTY, RATE, { fn CONCAT(INVOICE, '''')} as INVOICE, { fn CONCAT(PERVAL, '''')} as PERVAL, AMT, { fn CONCAT(PROTAX, '''')} as PROTAX, { fn CONCAT(TAXGRO, '''')} as TAXGRO, { fn CONCAT(TAXOVE, '''')} as TAXOVE, LINEXT, { fn CONCAT(REGIND, '''')} as REGIND, { fn CONCAT(GSTRAT, '''')} as GSTRAT, { fn CONCAT(GLACCT, '''')} as GLACCT from oeoo_s')
select @mError = @@error
if @mError <> 0 return @mError

truncate table [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_2]
select @mError = @@error
if @mError <> 0 return @mError
insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_2] select * from openquery(szy_winsol_odbc, 'select { fn CONCAT(SALORD, '''')} as SALORD, { fn CONCAT(ZERPAD3, '''')} as ZERPAD3, { fn CONCAT(ZERPAD4, '''')} as ZERPAD4, { fn CONCAT(ZER2PAD5, '''')} as ZER2PAD5, { fn CONCAT(RECTYP2, '''')} as RECTYP2, ORDDAT, { fn CONCAT(SIDEP, '''')} as SIDEP, { fn CONCAT(HOLFLA, '''')} as HOLFLA, { fn CONCAT(ORIBO, '''')} as ORIBO, { fn CONCAT(ACTFLA, '''')} as ACTFLA, { fn CONCAT(LASDOC, '''')} as LASDOC, { fn CONCAT(SHIHOL, '''')} as SHIHOL, { fn CONCAT(MANHOL, '''')} as MANHOL, { fn CONCAT(CREHOL, '''')} as CREHOL, { fn CONCAT(BELMIN, '''')} as BELMIN, { fn CONCAT(BELBO, '''')} as BELBO, { fn CONCAT(DELFLA, '''')} as DELFLA, OUTVAL, SHIVAL, REQDAT, { fn CONCAT(SHIPTO, '''')} as SHIPTO, { fn CONCAT(CONSGNMNT, '''')} as CONSGNMNT, { fn CONCAT(TAXGRO, '''')} as TAXGRO, { fn CONCAT(TRATYP, '''')} as TRATYP, { fn CONCAT(ORDSOU, '''')} as ORDSOU, { fn CONCAT(SALREP2, '''')} as SALREP2, COMSPL, { fn CONCAT(ORDMET, '''')} as ORDMET, { fn CONCAT(SALOFF, '''')} as SALOFF, { fn CONCAT(STATUS, '''')} as STATUS, { fn CONCAT(DISCNT, '''')} as DISCNT, { fn CONCAT(TAKBY, '''')} as TAKBY, { fn CONCAT(FRETER, '''')} as FRETER, { fn CONCAT(FOB, '''')} as FOB, { fn CONCAT(PROTECT, '''')} as PROTECT, { fn CONCAT(FLOCHG, '''')} as FLOCHG, { fn CONCAT(FLOSTO, '''')} as FLOSTO, { fn CONCAT(CRECAR, '''')} as CRECAR, { fn CONCAT(CURBOFLA, '''')} as CURBOFLA, { fn CONCAT(DOCREC, '''')} as DOCREC, { fn CONCAT(PRIORD, '''')} as PRIORD, { fn CONCAT(PRIHOL, '''')} as PRIHOL, { fn CONCAT(STORE, '''')} as STORE, { fn CONCAT(DEPT, '''')} as DEPT, { fn CONCAT(BILLAD, '''')} as BILLAD, EXPDAT, { fn CONCAT(QUOPRIMET, '''')} as QUOPRIMET, { fn CONCAT(QUOPRIFAC, '''')} as QUOPRIFAC, { fn CONCAT(RMA, '''')} as RMA, { fn CONCAT(TERMS, '''')} as TERMS, { fn CONCAT(LOTCOMP, '''')} as LOTCOMP, { fn CONCAT(LOTCOMMIT, '''')} as LOTCOMMIT, { fn CONCAT(SIREQBY, '''')} as SIREQBY, { fn CONCAT(PAYSTA, '''')} as PAYSTA, { fn CONCAT(PAYMET1, '''')} as PAYMET1, PAYAMT1, { fn CONCAT(EFTTRA1, '''')} as EFTTRA1, { fn CONCAT(PQUTRA1, '''')} as PQUTRA1, { fn CONCAT(PREAUTH1, '''')} as PREAUTH1, { fn CONCAT(PREDAT1, '''')} as PREDAT1, PREAMT1, PREUSE1, PREAVA1, PREEXP1, { fn CONCAT(PAYAUTH1, '''')} as PAYAUTH1, { fn CONCAT(PAYDAT1, '''')} as PAYDAT1, { fn CONCAT(PQUAUT1, '''')} as PQUAUT1, { fn CONCAT(PQUVOI1, '''')} as PQUVOI1, { fn CONCAT(PAYMET2, '''')} as PAYMET2, PAYAMT2, { fn CONCAT(EFTTRA2, '''')} as EFTTRA2, { fn CONCAT(PQUTRA2, '''')} as PQUTRA2, { fn CONCAT(PREAUTH2, '''')} as PREAUTH2, { fn CONCAT(PREDAT2, '''')} as PREDAT2, PREAMT2, PREUSE2, PREAVA2, PREEXP2, { fn CONCAT(PAYAUTH2, '''')} as PAYAUTH2, { fn CONCAT(PAYDAT2, '''')} as PAYDAT2, { fn CONCAT(PQUAUT2, '''')} as PQUAUT2, { fn CONCAT(PQUVOI2, '''')} as PQUVOI2, RECDAT, CANDAT, { fn CONCAT(PRIVAL, '''')} as PRIVAL, { fn CONCAT(ZONE, '''')} as ZONE, { fn CONCAT(STOALLPRI, '''')} as STOALLPRI, { fn CONCAT(LASSHP, '''')} as LASSHP, { fn CONCAT(OVRCRLMT, '''')} as OVRCRLMT, { fn CONCAT(DELNQNT, '''')} as DELNQNT from oeoo_2')
select @mError = @@error
if @mError <> 0 return @mError

truncate table [imported_and_deleted_orders_transfer_shipto]
select @mError = @@error
if @mError <> 0 return @mError
insert into [imported_and_deleted_orders_transfer_shipto] select * from shipping_info.dbo.shipping_info
select @mError = @@error
if @mError <> 0 return @mError


--delete records that were created after oeoo_1 was imported
delete from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_2]
where [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_2].SALORD not in(
select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1] )
select @mError = @@error
if @mError <> 0 return @mError

delete from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_P]
where [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_P].SALORD not in(
select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1] )
select @mError = @@error
if @mError <> 0 return @mError

delete from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_S]
where [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_S].SALORD not in(
select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1] )
select @mError = @@error
if @mError <> 0 return @mError

delete from [imported_and_deleted_orders_transfer_shipto]
where [imported_and_deleted_orders_transfer_shipto].SALORD not in(
select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1] )
select @mError = @@error
if @mError <> 0 return @mError


--add old sales order to new ones - up to rolling 60 days ago
declare @cut_off_date varchar(10)
set @cut_off_date = convert(varchar(10), dateadd(d, -60, getdate()),101)

insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1] 
	select * 
	from [IMPORTED_AND_DELETED_ORDERS_OEOO_1]
	where [IMPORTED_AND_DELETED_ORDERS_OEOO_1].SALORD not in(
	select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1])
	and 
	[IMPORTED_AND_DELETED_ORDERS_OEOO_1].SALORD in
	(
	select sales_order 
	from [IMPORTED_AND_DELETED_ORDERS_ORDERS]
	where deleted_date >= @cut_off_date
	)
select @mError = @@error
if @mError <> 0 return @mError

insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_P] 
	select * from [IMPORTED_AND_DELETED_ORDERS_OEOO_P]
	where [IMPORTED_AND_DELETED_ORDERS_OEOO_P].SALORD not in(
	select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_P])
	and 
	[IMPORTED_AND_DELETED_ORDERS_OEOO_P].SALORD in
	(
	select sales_order 
	from [IMPORTED_AND_DELETED_ORDERS_ORDERS]
	where deleted_date >= @cut_off_date
	)
select @mError = @@error
if @mError <> 0 return @mError

insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_S] 
	select * from [IMPORTED_AND_DELETED_ORDERS_OEOO_S]
	where [IMPORTED_AND_DELETED_ORDERS_OEOO_S].SALORD not in(
	select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_S])
	and 
	[IMPORTED_AND_DELETED_ORDERS_OEOO_S].SALORD in
	(
	select sales_order 
	from [IMPORTED_AND_DELETED_ORDERS_ORDERS]
	where deleted_date >= @cut_off_date
	)
select @mError = @@error
if @mError <> 0 return @mError

insert into [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_2]
	select * from [IMPORTED_AND_DELETED_ORDERS_OEOO_2]
	where [IMPORTED_AND_DELETED_ORDERS_OEOO_2].SALORD not in(
	select SALORD from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_2])
	and 
	[IMPORTED_AND_DELETED_ORDERS_OEOO_2].SALORD in
	(
	select sales_order 
	from [IMPORTED_AND_DELETED_ORDERS_ORDERS]
	where deleted_date >= @cut_off_date
	)
select @mError = @@error
if @mError <> 0 return @mError

insert into [imported_and_deleted_orders_transfer_shipto]
	select * from [imported_and_deleted_orders_shipto]
	where [imported_and_deleted_orders_shipto].SALORD not in(
	select SALORD from [imported_and_deleted_orders_transfer_shipto])
	and 
	[IMPORTED_AND_DELETED_ORDERS_shipto].SALORD in
	(
	select sales_order 
	from [IMPORTED_AND_DELETED_ORDERS_ORDERS]
	where deleted_date >= @cut_off_date
	)
select @mError = @@error
if @mError <> 0 return @mError


--make sure all old orders still exist before deleting current tables. this can't be done for oeoo_p.
set @missing_count = 0
set @missing_count = (
	select count(*) from
	[IMPORTED_AND_DELETED_ORDERS_OEOO_1] a left join [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1] b
	on a.salord = b.salord 
	where 
	a.salord in
	(
		select sales_order 
		from [IMPORTED_AND_DELETED_ORDERS_ORDERS]
		where deleted_date >= @cut_off_date
	)
	and
	b.salord is null
)
if @missing_count <> 0 return @missing_count


-- actual update
begin tran

truncate table [IMPORTED_AND_DELETED_ORDERS_OEOO_1]
select @mError = @@error
if @mError <> 0 goto error_handler
insert into [IMPORTED_AND_DELETED_ORDERS_OEOO_1] 
select * from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_1]
select @mError = @@error
if @mError <> 0 goto error_handler

truncate table [IMPORTED_AND_DELETED_ORDERS_OEOO_2]
select @mError = @@error
if @mError <> 0 goto error_handler
insert into [IMPORTED_AND_DELETED_ORDERS_OEOO_2] 
select * from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_2]
select @mError = @@error
if @mError <> 0 goto error_handler

truncate table [IMPORTED_AND_DELETED_ORDERS_OEOO_P]
select @mError = @@error
if @mError <> 0 goto error_handler
insert into [IMPORTED_AND_DELETED_ORDERS_OEOO_P] 
select * from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_P]
select @mError = @@error
if @mError <> 0 goto error_handler

truncate table [IMPORTED_AND_DELETED_ORDERS_OEOO_S]
select @mError = @@error
if @mError <> 0 goto error_handler
insert into [IMPORTED_AND_DELETED_ORDERS_OEOO_S] 
select * from [IMPORTED_AND_DELETED_ORDERS_TRANSFER_OEOO_S]
select @mError = @@error
if @mError <> 0 goto error_handler

truncate table [imported_and_deleted_orders_shipto]
select @mError = @@error
if @mError <> 0 goto error_handler
insert into [imported_and_deleted_orders_shipto] 
select * from [imported_and_deleted_orders_transfer_shipto]
select @mError = @@error
if @mError <> 0 goto error_handler

commit tran

return 0

error_handler:
rollback tran

return @mError




