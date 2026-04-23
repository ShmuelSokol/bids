-- dbo.imported_and_deleted_orders_orders  (246257 rows)
CREATE TABLE dbo.imported_and_deleted_orders_orders (
  p_id                 int NOT NULL,
  sales_order          char(6) NOT NULL,
  customer             varchar(7) NOT NULL,
  order_date           datetime NOT NULL,
  po_number            varchar(12) NOT NULL,
  deleted_by           varchar(30) NOT NULL,
  deleted_date         datetime NOT NULL DEFAULT (getdate()),
  last_action          smallint NOT NULL
);