-- dbo.winsol_table_import_log_update




CREATE     trigger winsol_table_import_log_update on winsol_table_import_log for update as
if update(update_serial_number)
insert into #IWT_SN (update_serial_number) select inserted.update_serial_number from inserted




