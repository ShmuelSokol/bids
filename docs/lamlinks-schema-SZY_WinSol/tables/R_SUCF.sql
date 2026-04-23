-- dbo.R_SUCF  (1167147 rows)
CREATE TABLE dbo.R_SUCF (
  CUSTMR               char(7) NOT NULL,
  Z_ATTN               varchar(32),
  Z_EMAIL              varchar(64),
  Z_RESID              char(1),
  PRIMARY KEY (CUSTMR)
);