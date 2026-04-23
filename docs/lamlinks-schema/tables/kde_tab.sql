-- dbo.kde_tab  (1 rows)
CREATE TABLE dbo.kde_tab (
  idnkde_kde           int NOT NULL,
  adtime_kde           datetime NOT NULL,
  k14rqr_kde           int NOT NULL,
  idnkdg_kde           int NOT NULL,
  t_type_kde           varchar(32) NOT NULL,
  tbltoa_kde           char(3) NOT NULL,
  idntoa_kde           int NOT NULL,
  toanam_kde           varchar(80) NOT NULL,
  a_comp_kde           varchar(32) NOT NULL,
  a_text_kde           varchar(160) NOT NULL,
  PRIMARY KEY (idnkde_kde)
);