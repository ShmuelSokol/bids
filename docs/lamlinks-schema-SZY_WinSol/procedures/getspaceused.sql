-- dbo.getspaceused


create procedure [dbo].[getspaceused]
as
--truncate table ##spaceused
--drop table ##spaceused
--truncate table ##spaceused
if object_id('tempdb..##spaceused')>0 drop table ##spaceused
create table ##spaceused
([name] varchar(75),
[rows] int,
[reserved] varchar(75),
[data] varchar(75),
[index_size] varchar(75),
[unused] varchar(75)
)

exec sp_msforeachtable 'insert ##spaceused exec sp_spaceused ''?'''
--go

update ##spaceused set index_size=replace(index_size,' KB','')
update ##spaceused set data=replace(data,' KB','')
update ##spaceused set reserved=replace(reserved,' KB','')
update ##spaceused set unused=replace(unused,' KB','')
alter table ##spaceused alter column index_size int
alter table ##spaceused alter column data int
alter table ##spaceused alter column reserved int
alter table ##spaceused alter column unused int
--alter table ##spaceused add totalspace numeric
--update ##spaceused set totalspace=index_size+data+reserved
select * from ##spaceused order by reserved desc