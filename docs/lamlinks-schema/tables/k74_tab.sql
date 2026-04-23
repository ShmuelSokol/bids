-- dbo.k74_tab  (13 rows)
CREATE TABLE dbo.k74_tab (
  idnk74_k74           int NOT NULL,
  addtme_k74           datetime NOT NULL,
  uptime_k74           datetime NOT NULL,
  upname_k74           char(10) NOT NULL,
  idnk73_k74           int NOT NULL,
  idnk71_k74           int NOT NULL,
  idnk57_k74           int NOT NULL,
  bomqty_k74           numeric(12,5) NOT NULL,
  qtyper_k74           char(20) NOT NULL,
  prj_up_k74           numeric(12,4) NOT NULL,
  prjaro_k74           int NOT NULL,
  upclas_k74           char(24) NOT NULL,
  updesc_k74           char(60) NOT NULL,
  pptype_k74           char(16) NOT NULL,
  pptset_k74           char(16) NOT NULL,
  pestup_k74           numeric(12,4) NOT NULL,
  estaro_k74           int NOT NULL,
  estcls_k74           char(24) NOT NULL,
  estupd_k74           char(60) NOT NULL,
  usestm_k74           char(30) NOT NULL,
  PRIMARY KEY (idnk74_k74)
);