-- dbo.Get_WinSol_DB_Value

CREATE procedure [dbo].[Get_WinSol_DB_Value]
	@table varchar(20),
	@selectExpression varchar(100),
	@selectName varchar(100),
	@whereColumn1 varchar(20),
	@whereAsString1 bit,
	@where1 varchar(100),
	@whereColumn2 varchar(20) = '',
	@whereAsString2 bit = 0,
	@where2 varchar(100) = '',
	@value varchar(100) out
as
begin
	declare @s nvarchar(100);
	declare @quotes varchar(2);
	declare @sql nvarchar(200);
	declare @lWhere varchar(500);

	set @table = ltrim(rtrim(@table))
	set @selectExpression = ltrim(rtrim(@selectExpression))
	set @selectName = ltrim(rtrim(@selectName))
	set @whereColumn1 = ltrim(rtrim(@whereColumn1))
	set @where1 = ltrim(rtrim(@where1))
	
	set @whereColumn2 = ltrim(rtrim(@whereColumn2))
	set @where2 = ltrim(rtrim(@where2))

	if @table = '' or @selectExpression = '' or @selectName = '' or @where1 = '' or @whereColumn1 = ''
	begin
		--blanks not allowed, return without querying
		set @value = '';
		return;
	end;

	if @whereAsString1 = 1
		set @quotes = ''''''
	else
		set @quotes = ''
	
	set @lWhere = ' where ' + @whereColumn1 + ' = ' + @quotes + @where1 + @quotes;

	if @where2 <> ''
	begin
		if @whereAsString2 = 1
			set @quotes = ''''''
		else
			set @quotes = ''

		set @lWhere = @lWhere + ' and ' + @whereColumn2 + ' = ' + @quotes + @where2 + @quotes;
	end;

	set @sql = 
		'select @s = ' + @selectName + 
		' from openquery(SZY_WinSol_ODBC, ''select ' + @selectExpression + ' as ' + @selectName + ' from ' + @table + 
		+ @lWhere + ''')';
		
	exec sp_executesql @sql, N'@s nvarchar(100) out', @s = @s out;
		
	set @value = @s;
	
end;
