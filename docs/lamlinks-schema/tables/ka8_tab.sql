-- dbo.ka8_tab  (150157 rows)
CREATE TABLE dbo.ka8_tab (
  idnka8_ka8           int NOT NULL,
  uptime_ka8           datetime NOT NULL,
  upname_ka8           char(10) NOT NULL,
  job_no_ka8           int NOT NULL,
  jobdte_ka8           datetime NOT NULL,
  jlnact_ka8           int NOT NULL,
  jlnoct_ka8           int NOT NULL,
  jobsta_ka8           char(15) NOT NULL,
  stadte_ka8           datetime NOT NULL,
  pinval_ka8           numeric(13,2) NOT NULL,
  xinval_ka8           numeric(13,2) NOT NULL,
  potval_ka8           numeric(13,2) NOT NULL,
  selval_ka8           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnka8_ka8)
);