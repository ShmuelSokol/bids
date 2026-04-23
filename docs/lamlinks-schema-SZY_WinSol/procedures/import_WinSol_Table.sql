-- dbo.import_WinSol_Table














CREATE                   procedure [dbo].[import_WinSol_Table]
	@tableName VARCHAR(100),
	@namePrefix varchar(100),
	@byColumn bit,
	@columnList varchar(2000) = null,
	@inlineIndexesConstraints varchar(2000) = null,
	@recreateTableDef BIT,
	@where varchar(2000) = null,
	@replaceNullColumnList varchar(2000) = null,
	@WTIL_SN int = null output
AS

-- input parameters help:
-- @tableName is the source table name and destination table, or the suffix of the destination table name if a @namePrefix is provided
-- @namePrefix is the prefix of the destination table name. optional. if provided, the destination table name will be @namePrefix_@tableName
-- @byColumn when 0, specifies that all source table columns should be imported. when 1, @columnList will be used to determin columns to import. must be 1 if you want to use the @inlineIndexesConstraints or @replaceNullColumnList options.
-- @columnList comma separated list of source table columns to import with optional destination column type which will be used when creating the column in the destination table in the format of "column name [| column definition]". must be provided if @byColumn is 1.
-- @inlineIndexesConstraints text of constraints that will be included in the create table statemnt for the destination table creation. @byColumn must be 1 to use this option.
-- @recreateTableDef when 0, column defintion for all source table columns will be retrieved from def_@tableName table. if def_@tableName table does not exist or @recreateTableDef is set to 1, an empty def_@tableName table will be created with all columns in the source table definition to use for building the @WinSolSql string and destination column type defintions if @byColumn is used. if the def_@tableName already existed and 1 was specified, the def_@tableName will be recreated.
-- @where where condition used to limit the records returned from the source data table.
-- @replaceNullColumnList bactick (`) separated list used to specify an isnull value to run on columns of the source table in the select from source table statement. @byColumn must be 1 to use this option. format: "column name | isnull(column name, value if null)"
-- @WTIL_SN output var of imported table serial number returned to caller if any



DECLARE @sql VARCHAR(8000)
DECLARE @WinSolSql VARCHAR(8000)
declare @tableDefName varchar(100)
declare @columnName varchar(100)
declare @columnType varchar(20)
declare @namePrefixTableName varchar(100)
declare @columnListTable table ([column] varchar(100), column_def varchar(100))
declare @isNullColumnListTable table ([column] varchar(100), column_isnull varchar(100))
declare @idx int, @idy int
declare @myERROR int
declare @now varchar(30)
declare @origColumnList varchar(2000)
declare @thisColumn varchar(100)
declare @thisColumnDef varchar(100)
declare @columnPrec smallint
declare @columnScale int
declare @missingColumn varchar(100)
declare @columnSelectList varchar(2000)
declare @thisIsNullColumn varchar(100)

if len(@namePrefix) > 0
	set @namePrefixTableName = @namePrefix + '_' + @tableName
else
	set @namePrefixTableName = @tableName

set @tableDefName = 'def_' + @tableName

if @byColumn = 1
begin
	if isnull(@columnList, '') = ''
	begin
		raiserror('@byColumn is set but @columnList is blank or null.', 16, 1)
		return -2
	end
	else
	begin
		set @columnList = replace(replace(replace(replace(@columnList, char(13) + char(10), ' '), char(13), ' '), char(10), ' '), char(9), ' ')
		set @origColumnList = @columnList
	end
end
else
	set @origColumnList = ''

if @byColumn = 1
begin
	while len(@columnList) > 0
	begin
		set @idx = charindex(',', @columnList)

		if @idx = 0
		begin
			set @thisColumn = @columnList
			set @idy = charindex('|', @thisColumn)
			if @idy = 0
			begin
				set @thisColumn = ltrim(rtrim(@thisColumn))
				set @thisColumnDef = null
			end
			else
			begin
				set @thisColumnDef = replace(@thisColumn, '|', '')
				set @thisColumn = ltrim(rtrim(left(@thisColumn, @idy - 1)))
			end
			
			insert into @columnListTable ([column], column_def) values(@thisColumn, @thisColumnDef)
		
			set @columnList = ''
		end
		else
		begin
			set @thisColumn = left(@columnList, @idx - 1)
			set @idy = charindex('|', @thisColumn)
			if @idy = 0
			begin
				set @thisColumn = ltrim(rtrim(@thisColumn))
				set @thisColumnDef = null
			end
			else
			begin
				set @thisColumnDef = replace(@thisColumn, '|', '')
				set @thisColumn = ltrim(rtrim(left(@thisColumn, @idy - 1)))
			end
			
			insert into @columnListTable ([column], column_def) values(@thisColumn, @thisColumnDef)			
			
			set @columnList = right(@columnList, len(@columnList) - @idx)
		end
	end
	
	if @replaceNullColumnList is not null
	begin
		while len(@replaceNullColumnList) > 0
		begin
			set @idx = charindex('`', @replaceNullColumnList)	
			if @idx = 0
			begin
				set @thisColumn = @replaceNullColumnList
				set @idy = charindex('|', @thisColumn)
				set @thisColumnDef = right(@thisColumn, len(@thisColumn) - @idy)
				set @thisColumn = ltrim(rtrim(left(@thisColumn, @idy - 1)))
				
				insert into @isNullColumnListTable ([column], column_isnull) values(@thisColumn, @thisColumnDef)
			
				set @replaceNullColumnList = ''
			end
			else
			begin
				set @thisColumn = left(@replaceNullColumnList, @idx - 1)
				set @idy = charindex('|', @thisColumn)
				set @thisColumnDef = right(@thisColumn, len(@thisColumn) - @idy)
				set @thisColumn = ltrim(rtrim(left(@thisColumn, @idy - 1)))
				
				insert into @isNullColumnListTable ([column], column_isnull) values(@thisColumn, @thisColumnDef)
				
				set @replaceNullColumnList = right(@replaceNullColumnList, len(@replaceNullColumnList) - @idx)
			end
		end
	end
end

IF @recreateTableDef = 1 or not exists(SELECT [name] FROM sysobjects WHERE [name] = @tableDefName AND xtype = 'U')
BEGIN
	IF EXISTS (SELECT [name] FROM sysobjects WHERE [name] = @tableDefName AND xtype = 'U')
		EXEC ('DROP TABLE [' + @tableDefName + ']')
	set @sql = 'select * into [' + @tableDefName +
		'] from openquery(SZY_WinSOL_ODBC, ''select * from ' + @tableName + ' where 1 = 2'')'
	exec (@sql)
END

if @byColumn = 1
begin
	set @missingColumn = (select top 1 [column] from @columnListTable c where
			not exists (select b.colid from sysobjects a inner join syscolumns b on a.id
				= b.id where a.name = @tableDefName and b.name = c.[column]))
	if @missingColumn is not null
	begin
		raiserror('The %s field in the column list was not found in the table definition.', 16, 1, @missingColumn)
		return -2
	end
end

IF EXISTS (SELECT [name] FROM sysobjects WHERE [name] = @namePrefixTableName AND xtype = 'U')
		EXEC ('DROP TABLE [' + @namePrefixTableName + ']')

if @byColumn = 1
begin
	set @sql = 'create table [' + upper(@namePrefixTableName) + '] ('
	
	declare columnDefs cursor local forward_only for
		select a.[column], a.column_def, d.name, c.prec, c.scale from
			sysobjects b inner join syscolumns c on b.id = c. id inner join systypes d on c.xtype = d.xtype
				inner join @columnListTable a on c.name = a.[column]
			where b.xtype = 'U' and b.name = @tableDefName
			order by c.colid
	for read only
	
	open columnDefs

	set @columnSelectList = ''

	fetch next from columnDefs into @thisColumn, @thisColumnDef, @columnType, @columnPrec, @columnScale

	while @@fetch_status = 0
	begin
		set @columnList = @columnList + @thisColumn + ', '
		
		if @replaceNullColumnList is not null
		begin
			set @thisIsNullColumn = (select column_isnull from @isNullColumnListTable where [column] = @thisColumn)
			set @columnSelectList = @columnSelectList + isnull(@thisIsNullColumn, @thisColumn) + ', '
		end
		
		if @thisColumnDef is null
		begin
			if @columnType = 'varchar' or @columnType = 'char'
			begin
				if @columnPrec < 4
					set @sql = @sql + upper(@thisColumn) + ' char(' + cast(@columnPrec as char(1)) + '), '
				else
					set @sql = @sql + upper(@thisColumn) + ' varchar(' + cast(@columnPrec as varchar(4)) + '), '
			end
			else if @columnType = 'numeric' or @columnType = 'decimal'
				set @sql = @sql + upper(@thisColumn) + ' ' + @columnType + '(' + cast(@columnPrec as varchar(4)) + 
					', ' + cast(@columnScale as varchar(4)) + '), '
			else if @columnType = 'float' or @columnType = 'real'
				set @sql = @sql + upper(@thisColumn) + ' ' + @columnType + '(' + cast(@columnPrec as varchar(4)) + '), '
			else
				set @sql = @sql + upper(@thisColumn) + ' ' + @columnType + ', '
		end
		else
			set @sql = @sql + upper(@thisColumnDef) + ', '
	
		fetch next from columnDefs into @thisColumn, @thisColumnDef, @columnType, @columnPrec, @columnScale
	end
	
	close columnDefs
	
	deallocate columnDefs
	
	set @columnList = left(@columnList, len(@columnList) - 1)

	if @columnSelectList = ''
		set @columnSelectList = @columnList
	else
		set @columnSelectList = left(@columnSelectList, len(@columnSelectList) - 1)
	
	if @inlineIndexesConstraints is not null
		set @sql = @sql + @inlineIndexesConstraints + ')'
	else
		set @sql = left(@sql, len(@sql) - 1) + ')'
	
	exec (@sql)
end

set @WinSolSql = 'select'

declare columnDefs cursor local forward_only
	for select syscolumns.name, systypes.name
		from sysobjects inner join syscolumns on 
		sysobjects.id = syscolumns.id inner join systypes on
		syscolumns.xtype = systypes.xtype 
		where sysobjects.xtype = 'U' and sysobjects.name = @tableDefName
		order by syscolumns.colid
	for read only

open columnDefs

fetch next from columnDefs into @columnName, @columnType

while @@fetch_status = 0
begin
	if (@byColumn = 1 and @columnName in (select [column] from @columnListTable)) or @byColumn = 0
	begin
		if @columnType in ('varchar', 'char')
			set @WinSolSql = @WinSolSql + ' { fn CONCAT({ fn IFNULL(' + @columnName + ', '''''''')}, '''''''')} as ' + @columnName + ','
		else if @columnType in ('numeric', 'decimal')
			set @WinSolSql = @WinSolSql + ' { fn IFNULL(' + @columnName + ', 0)} as ' + @columnName + ','
		else if @columnType = 'date'
			set @WinSolSql = @WinSolSql + ' { fn IFNULL(' + @columnName + ', { d ''''1800-01-01'''' })} as ' + @columnName + ','
		else
			set @WinSolSql = @WinSolSql + ' ' + @columnName + ','
	end


	--if (@columnType = 'char' or @columnType = 'varchar') and ((@byColumn = 1 and @columnName in (select [column] from @columnListTable)) or @byColumn = 0)
	--	set @WinSolSql = @WinSolSql + ' { fn CONCAT({ fn ifnull(' + @columnName + ', '''''''')}, '''''''')} as ' + @columnName + ','
	--else if (@byColumn = 1 and @columnName in (select [column] from @columnListTable)) or @byColumn = 0
	--	set @WinSolSql = @WinSolSql + ' ' + @columnName + ','


	fetch next from columnDefs into @columnName, @columnType
end

close columnDefs

deallocate columnDefs

set @WinSolSql = substring(@WinSolSql, 1, len(@WinSolSql) - 1) + ' from ' + @tableName

IF @where is not null
BEGIN
	set @where = replace(@where, '''', '''''')
	set @WinSolSql = @WinSolSql + ' ' + @where
END

if @byColumn = 1
	set @sql = 'insert into [' + upper(@namePrefixTableName) + '] (' + @columnList + ') 
		select ' + @columnSelectList + ' from openquery(szy_winsol_odbc, ''' + @WinSolSql + ''')'
else
	set @sql = 'select * into [' + upper(@namePrefixTableName) + '] from openquery(szy_winsol_odbc, ''' + @WinSolSql + ''')'


set @now = convert(varchar(30), current_timestamp, 109)

if (select count(*) from winsol_table_import_log where table_name = @namePrefixTableName) = 0
begin
	set @WTIL_SN = isnull((select top 1 update_serial_number from 
		group_update_log_tables where table_name = @namePrefixTableName
		order by update_serial_number desc), 0) + 1
	exec ('insert into winsol_table_import_log (table_name, table_source, last_update, update_result, update_serial_number,
		column_list, where_condition) 
		values(''' + @namePrefixTableName + ''', ''' + @tableName + ''', ''' + @now + ''', -1, ' + @WTIL_SN + ', 
		''' + @origColumnList + ''', ''' + @where + ''')')
	--print '1---->'
	--print @sql
	exec (@sql)
	set @myERROR = @@ERROR
end
else
begin
	create table #IWT_SN (update_serial_number int)
	exec ('update winsol_table_import_log set table_source = ''' + @tableName + ''', last_update = ''' + @now + ''', 
		update_result = -1, update_serial_number = update_serial_number + 1, column_list = ''' + @origColumnList + ''', 
		where_condition = ''' + @where + ''' where table_name = ''' + @namePrefixTableName + '''')
	set @WTIL_SN = (select update_serial_number from #IWT_SN)
	--print '2--->'
	--print @sql
	exec (@sql)
	set @myERROR = @@ERROR
end

-- don't know why i had this in the first place. record should always exist from previous if. could be code is left over from older version
-- if i ever want to use this, i need to update it by checking the changes made to the insert above
--if (select count(*) from winsol_table_import_log where table_name = @namePrefixTableName) = 0
--	exec ('insert into winsol_table_import_log (table_name, table_source, last_update, update_result, 
--		column_list, where_condition) values(
--		''' + @namePrefixTableName + ''', ''' + @tableName + ''', ''' + @now + ''', ' + @myERROR + ', 
--		column_list = ''' + @columnList + ''', where_condition = ''' + @where + ''')')
--else
	exec ('update winsol_table_import_log set update_result = ' + @myERROR + ' where table_name = ''' + @namePrefixTableName + '''')

delete from winsol_table_import_log where table_name not in (
	SELECT [name] FROM sysobjects WHERE xtype = 'U')

return















