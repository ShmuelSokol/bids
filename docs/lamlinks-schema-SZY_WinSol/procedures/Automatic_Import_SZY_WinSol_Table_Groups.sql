-- dbo.Automatic_Import_SZY_WinSol_Table_Groups









CREATE       procedure Automatic_Import_SZY_WinSol_Table_Groups as

declare @lastClosingDate datetime
declare @groupName varchar(100)
declare @startTime datetime
declare @statusCode int
declare @lastUpdateStart datetime
declare @resultCode smallint
declare @mspid int
declare @struid varchar(30)
declare @binuid binary(128)

update automatic_group_update_settings set lastUpdateResult = -3
where lastUpdateResult = -1 
	and (not exists (select p.spid from master.dbo.sysprocesses p 
	where p.context_info = last_context_info) or datediff(hh, lastUpdateAttempt, getdate()) >= 23)

set @mspid = @@spid
set @struid = cast(@mspid as varchar(30)) + convert(varchar(30), getdate(), 109)
set @binuid = cast(@struid as binary(128))

set context_info @binuid

set @lastClosingDate = (select top 1 LastClosingTime from LastClosing)

declare groups cursor for
select groupName from automatic_group_update_settings where [update] = 1 
	and isnull(lastUpdateStart, '1/1/1900') < @LastClosingDate  
	and lastUpdateResult <> -1
order by updateSort

open groups

fetch next from groups into @groupName
while @@fetch_status = 0
begin
	set @startTime = getdate()

	update automatic_group_update_settings
		set lastUpdateStart = null, lastUpdateAttempt = @startTime, 
			lastUpdateDuration = null,
			lastUpdateResult = -1,
			last_context_info = @binuid
		where groupName = @groupName

	exec @statusCode = import_winsol_tables_by_group @groupName = @groupName
	if @statusCode = 0
	begin
		set @lastUpdateStart = @startTime
		set @resultCode = 0
	end
	else
	begin
		set @lastUpdateStart = null
		set @resultCode = -2
	end

	update automatic_group_update_settings
		set lastUpdateStart = @lastUpdateStart, 
			lastUpdateDuration = (GetDate() - @startTime),
			lastUpdateResult = @resultCode
		where groupName = @groupName

	fetch next from groups into @groupName
end

close groups
deallocate groups








