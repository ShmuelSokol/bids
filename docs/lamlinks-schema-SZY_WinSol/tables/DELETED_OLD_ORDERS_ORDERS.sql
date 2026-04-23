-- dbo.DELETED_OLD_ORDERS_ORDERS  (5772 rows)
CREATE TABLE dbo.DELETED_OLD_ORDERS_ORDERS (
  p_id                 int NOT NULL,
  oeoo_1_p_id          int NOT NULL,
  sales_order          char(6) NOT NULL,
  requested_by         varchar(30) NOT NULL,
  deleted_date         datetime NOT NULL
);