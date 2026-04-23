-- dbo.ar_analysis_rev1  (36687 rows)
CREATE TABLE dbo.ar_analysis_rev1 (
  month_ending         datetime NOT NULL,
  CUSTMR               char(7) NOT NULL,
  INVOICE              char(7) NOT NULL,
  INVCDAT              datetime,
  INVCAMT              numeric(10,2),
  balance              numeric(38,2),
  1-30                 numeric(38,2),
  31-60                numeric(38,2),
  61-90                numeric(38,2),
  91-120               numeric(38,2),
  121+                 numeric(38,2),
  aging_date_TOTPAY    numeric(38,2),
  PRIMARY KEY (month_ending, CUSTMR, INVOICE)
);