-- dbo.ka2_tab  (0 rows)
CREATE TABLE dbo.ka2_tab (
  idnka2_ka2           int NOT NULL,
  uptime_ka2           datetime NOT NULL,
  upname_ka2           char(10) NOT NULL,
  idnka1_ka2           int NOT NULL,
  silcls_ka2           char(16) NOT NULL,
  sil_no_ka2           int NOT NULL,
  sildes_ka2           varchar(240) NOT NULL,
  silqty_ka2           int NOT NULL,
  sil_up_ka2           numeric(13,4) NOT NULL,
  sil_ui_ka2           char(2) NOT NULL,
  silext_ka2           numeric(13,2) NOT NULL,
  PRIMARY KEY (idnka2_ka2)
);