-- dbo.imported_and_deleted_orders_actions  (5 rows)
CREATE TABLE dbo.imported_and_deleted_orders_actions (
  action_code          smallint NOT NULL,
  description          varchar(300) NOT NULL,
  PRIMARY KEY (action_code)
);