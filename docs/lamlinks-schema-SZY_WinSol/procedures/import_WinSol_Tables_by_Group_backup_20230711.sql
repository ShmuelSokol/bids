-- dbo.import_WinSol_Tables_by_Group_backup_20230711





















CREATE	procedure [dbo].[import_WinSol_Tables_by_Group_backup_20230711]
	@groupName varchar(100)

as

declare @RUL_SN int
declare @tableName varchar(100)
declare @namePrefix varchar(100)
declare @fullTableName varchar(100)
declare @byColumn bit
declare @columnList varchar(2000)
declare @inlineIndexesConstraints varchar(1000)
declare @recreateTableDef bit
declare @where varchar(2000)
declare @WTIL_SN int
declare @tableCount smallint
declare @return_status int
declare @indexesConstraints varchar(2000)
declare @replaceNullColumnList varchar(1000)
declare @groupParams table (tableName varchar(100), namePrefix varchar(100), byColumn bit, columnList varchar(2000), 
	constraints varchar(1000), recreateTableDef bit, [where] varchar(2000), fullTableName varchar(100), 
	replaceNullColumnList varchar(1000))


if @groupName = 'r_group'
begin
	print 'starting ' + @groupName + ' group tables import'
	insert into @groupParams (tableName, namePrefix, byColumn, columnList, constraints, recreateTableDef, [where], replaceNullColumnList)
	select 'inih', 'r', 1, 
		'invoice | char (7), invcdat | datetime, salord, docmnt, custmr | char(7), custmrpo, shipto | char(6), 
			artot, sales, sasales, cos, sacos, supcha, saloff, tax, sagmper, salrep, orddat | datetime, terms, ordsou, payoff', 
		'constraint pkc_r_inih_invoice primary key clustered (invoice)', 0, null, null union all
	select 'inidp', 'r', 1, 
		'invoice | char(7), line | char(3), prodct, prodctdes, sku, lispri, per, perval, tat, 
			linext, ordqty, boqty, canqty, shiqty, openqty, invqty, unicst, wghtcst, sasales, z_selcod, z_selrat, z_selqty, z_selpri',
		'constraint pkc_r_inidp_invoice_line primary key clustered (invoice, line)', 0, null, null union all
	select 'inid_3', 'r', 1, 
		'invoice | char(7), linek | char(3), supchades, amt',
		'constraint pkc_r_inid_3_invoice_linek primary key clustered (invoice, linek)', 0, null, null union all
	select 'sucu', 'r', 1, 'custmr | char(7), cusnam, addr1, addr2, addr3, postal, provnc, countr, custyp, telphn, fax, SUTERMS, arbal,
			saloff, seninv, EMLINVCON', 
		'constraint pkc_r_sucu_custmr primary key clustered (custmr)', 0, null, null union all
	select 'insh', 'r', 1, 'invoice | char(7), shiptonam, addr1, addr2, addr3, postal, provnc, countr', 
		'constraint pkc_r_insh_invoice primary key clustered (invoice)', 0, null, null union all
	select 'sush', 'r', 1, 'custmr |char(7), shipto | char(6), shiptonam, addr1, addr2, addr3, postal, provnc, countr', 
		'constraint UQC_r_sush_custmr_shipto unique clustered (custmr, shipto)', 0, null, null union all
	select 'poph', 'r', 1, 'PRODCT | char(20), RECPT | char(5), RECLIN | char(3), PURORD, PURORDLIN, SUPPLR, PODAT | datetime,
		RECDAT | datetime, BUYUOM, SKU, BUYPRIUOM, PURPRI, PURDIS, TOTDOLLAN, ORDQTY, RECQTY, RECQTYSKU, TYPE, CURSEQ, CALLEATIM, 
		EXPDAT | datetime, PRIBRE', 
		'constraint PKC_R_POPH_PRODCT_RECPT_RECLIN primary key clustered(prodct, recpt, reclin)', 0,
		'where prodct is not null', null union all
	select 'pos', 'r', 1, 'SUPPLR | char(6), SUPPLRDES, addrss1, addrss2, addrss3, postal, country, telphn, fax, wats', 
		'constraint PKC_R_POS_SUPPLR primary key clustered(supplr)', 0, null, null union all
	-- maurice 5/27/2020
	-- added buyunt,selunt
	select 'popi', 'r', 1, 'prodct | char(20), SUPPLR | char(6), suppro, suppro2, purpri, per, buyunt, selunt', 
		'constraint PKC_R_POPI_PRODCT_SUPPLR primary key clustered(prodct, supplr)', 0, null, null union all
	select 'icwm', 'r', 1, 'whse | char(2), prodct | char(20), priloc, onhqty, wghtcst, latcst, ordqty, resqty, boqty', 
		'constraint PKC_R_ICWM_PRODCT_WHSE primary key clustered(PRODCT, WHSE)', 0, 
		'where prodct is not null', null union all
	select 'ici1', 'r', 1, 'prodct | char(20), prodctdes, secloc, sku, protyp', 
		'constraint PKC_R_ICI1_PRODCT primary key clustered(PRODCT)', 0, null, null union all
	select 'icsd', 'r', 1, 'prodct | char(20), descr2', 
		'constraint PKC_R_ICSD_PRODCT primary key clustered(PRODCT)', 0, null, null union all
	select 'inid_l', 'r', 1, 'invoice | char(7), linek | char(3), rectyp', 
		'constraint PKC_R_INID_L_INVOICE_LINEK primary key clustered(invoice, linek)', 0, null, null union all
	select 'sucf', 'r', 1, 'custmr | char(7), z_attn, z_email, z_resid', 
		'constraint pkc_r_sucf_custmr primary key clustered (custmr)', 0, null, null union all
	select 'inid_2', 'r', 1, 'invoice | char(7), linek | char(3), comment, prodct, setrem, gendet, pridoc, life', 
		'constraint PKC_R_INID_2_INVOICE_LINEK primary key clustered(invoice, linek)', 0, null, null union all
	select 'arrc', 'r', 1, 'custmr | char(7), lassaldat | datetime, arbal, duedatold | datetime', 
		'constraint pkc_r_arrc_custmr primary key clustered (custmr)', 0, null, 'custmr | isnull(custmr, '''')' union all
	select 'arar', 'r', 1, 
		'custmr | char(7), INVOICE | char(7), LASTRA, INVCDAT | datetime, INVCAMT, TOTPAY, TERMS, SALORD, SOLDTO, GSTAMT, 
			BILLAD, DISALL, DISTAK, QUIPAYDAT | datetime',
		'constraint pkc_r_arar_custmr_invoice primary key clustered (custmr, invoice)', 0, null, null union all
	select 'inihp', 'r', 1, 
		'CUSTMR | char(7), INVOICE | char(7), TRANSCTN | char(2), PAYDAT | datetime, PAYAMT, DISTAK, CHEQUE, DIFCUS, ADJFLA,
			CHEAMT, INVCAMT, INVCDAT | datetime, CHECUSTMR, GLACCT',
		'constraint pkc_r_inihp_custmr_invoice_transctn primary key clustered (custmr, invoice, transctn)', 0, null, null

	
	set @indexesConstraints = '
		create	index IX_R_INIH_INVCDAT on r_inih(invcdat)
		create	index IX_R_INIH_CUSTMR_SHIPTO on r_inih(custmr, shipto)
		create	index IX_R_POPH_SUPPLR on r_poph(supplr)
		create	index IX_R_POPH_RECDAT on r_poph(RECDAT)
		create	index IX_R_POPH_RECPT_RECLIN on r_poph(RECPT, RECLIN)
		create	index IX_R_POPH_PURORD on r_poph(PURORD)
		create	index IX_R_POPH_PODAT on r_poph(PODAT)
		create	index IX_R_POPI_SUPPLR on r_popi(supplr)
		create	index IX_R_INIHP_CHECUSTMR_CHEQUE_PAYDAT_CHEAMT on r_inihp(CHECUSTMR, CHEQUE, PAYDAT, CHEAMT)'
end

else if @groupName = 'totals_inih'
begin
	print 'starting ' + @groupName + ' group tables import'
	insert into @groupParams (tableName, namePrefix, byColumn, columnList, constraints, recreateTableDef, [where], replaceNullColumnList)
	select 'inih', 'totals', 1, 'invoice, invcdat, custmr, saloff, cos, sacos, sales, sasales, supcha, tax, artot', 
		null, 0, null, null
end

else if @groupName = 'sales_by_item_with_invoice_detail'
begin
	print 'starting ' + @groupName + ' group tables import'
	insert into @groupParams (tableName, namePrefix, byColumn, columnList, constraints, recreateTableDef, [where], replaceNullColumnList)
	select 'inih', 'r', 1, 'invoice, invcdat, custmr, saloff', null, 0, null, null union all
	select 'inidp', 'r', 1, 'invoice, prodct, prodctdes, sku, lispri, per, perval, shiqty, unicst, wghtcst', 
		null, 0, null, null
end

else if @groupName = 'test'
begin
	print 'starting ' + @groupName + ' group tables import'
	insert into @groupParams (tableName, namePrefix, byColumn, columnList, constraints, recreateTableDef, [where], replaceNullColumnList)
	select 'oeoo_1', '', 1, 'salord', 'constraint pkc_oeoo_1_salord primary key clustered (salord)', 0, null, null union all
	select 'oeoo_2', '', 1, 'salord, orddat, shipto, saloff', null, 0, null, null
end

else if @groupName = 'test2'
begin
	print 'starting ' + @groupName + ' group tables import'
	insert into @groupParams (tableName, namePrefix, byColumn, columnList, constraints, recreateTableDef, [where], replaceNullColumnList)
	select 'ici1', 'r', 1, 'prodct | char(20), prodctdes, secloc', 
		'constraint PKC_R_ICI1_PRODCT primary key clustered(PRODCT)', 0, null, null union all
	select 'icsd', 'r', 1, 'prodct | char(20), descr2', 
		'constraint PKC_R_ICSD_PRODCT primary key clustered(PRODCT)', 0, null, null union all
	select 'inid_l', 'r', 1, 'invoice | char(7), linek | char(3), rectyp', 
		'constraint PKC_R_INID_L_INVOICE_LINEK primary key clustered(invoice, linek)', 0, null, null
end

else
begin
	print @groupName + ' group table definitions not found'
	return
end

update @groupParams set fullTableName = case namePrefix when '' then tableName else namePrefix + '_' + tableName end

if (select count(*) from group_update_log where group_name = @groupName) = 0
begin
	insert into group_update_log (group_name, last_updated, update_serial_number, status, table_count)
		values(@groupName, getdate(), 1, -1, 0)
set @RUL_SN = 1
end
else
begin
	create  table #RUL_SN (update_serial_number int)
	update group_update_log set last_updated = getdate(), update_serial_number = update_serial_number + 1,
		status = -1, table_count = 0 where group_name = @groupName
	set @RUL_SN = (select update_serial_number from #RUL_SN)
end	

update group_update_log set table_count = (select count(*) from @groupParams) where group_name = @groupName

delete from group_update_log_tables where group_name = @groupName and table_name not in (select fullTableName from @groupParams)

declare groupParams cursor local forward_only
	for select 
		tableName, namePrefix, byColumn, columnList, constraints, recreateTableDef, [where], 
			fullTableName, replaceNullColumnList
		from @groupParams
	for read only

open groupParams

fetch next from groupParams into @tableName, @namePrefix, @byColumn, @columnList, 
	@inlineIndexesConstraints, @recreateTableDef, @where, @fullTableName, @replaceNullColumnList

while @@fetch_status = 0
begin
	print 'starting ' + @tableName + ' table import'
	if (select count(*) from group_update_log_tables where group_name = @groupName and table_name = @fullTableName) = 0
		insert into group_update_log_tables (group_name, table_name, group_update_log_USN, 
		update_serial_number, status) values(@groupName, @fullTableName, @RUL_SN, 0, -1)
	else
		update group_update_log_tables set group_update_log_USN = @RUL_SN, status = -1 
			where group_name = @groupName and table_name = @fullTableName
		
		--print 'import_winsol_table '
		--print '@tableName = ' +@tableName
		--print ',@namePrefix = '+ @namePrefix
		--print ',@byColumn = ' + cast(@byColumn as varchar)
		--print ',@columnList = '+@columnList
		--print ',@inlineIndexesConstraints = '+@inlineIndexesConstraints
		--print ',@recreateTableDef = '+ cast(@recreateTableDef as varchar)
		--print ',@where = '+@where
		--print ',@replaceNullColumnList = '+@replaceNullColumnList
		--print ',@WTIL_SN = '+cast(@WTIL_SN as varchar)+'OUTPUT'

		
	exec @return_status = import_WinSol_Table 
		@tableName = @tableName, 
		@namePrefix = @namePrefix, 
		@byColumn = @byColumn,
		@columnList = @columnList,
		@inlineIndexesConstraints = @inlineIndexesConstraints,
		@recreateTableDef = @recreateTableDef,
		@where = @where,
		@replaceNullColumnList = @replaceNullColumnList,
		@WTIL_SN = @WTIL_SN OUTPUT
	
	if @return_status = 0
		update group_update_log_tables set update_serial_number = @WTIL_SN, status = 1 
			where group_name = @groupName and table_name = @fullTableName
	else
		update group_update_log_tables set status = isnull(@return_status, -100) 
			where group_name = @groupName and table_name = @fullTableName


	print 'finished ' + @tableName + ' table import'

	fetch next from groupParams into @tableName, @namePrefix, @byColumn, @columnList, 
		@inlineIndexesConstraints, @recreateTableDef, @where, @fullTableName, @replaceNullColumnList

end

close groupParams

deallocate groupParams

if @indexesConstraints is not null
begin
	print 'starting index/constraint creation'
	exec (@indexesConstraints)
	print 'finished index/constraint creation'
end

update group_update_log set status = 1 where group_name = @groupName

print 'finished ' + @groupName + ' group tables import'






















