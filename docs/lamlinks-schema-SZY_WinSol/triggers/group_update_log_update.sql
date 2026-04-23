-- dbo.group_update_log_update



CREATE  trigger group_update_log_update on group_update_log for update as
if update(update_serial_number)
insert into #RUL_SN (update_serial_number) select inserted.update_serial_number from inserted


