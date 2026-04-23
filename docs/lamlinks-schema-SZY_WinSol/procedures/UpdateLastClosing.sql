-- dbo.UpdateLastClosing




CREATE    procedure UpdateLastClosing as 

set nocount on
update LastClosing set LastClosingTime = GetDate()
select @@error



