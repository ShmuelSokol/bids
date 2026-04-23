-- dbo.t_activelistings  (9382 rows)
CREATE TABLE dbo.t_activelistings (
  listing-id           varchar(11),
  seller-sku           varchar(50),
  price                float,
  quantity             bigint,
  open-date            varchar(23),
  fulfillment-channel  varchar(9),
  asin1                varchar(10)
);