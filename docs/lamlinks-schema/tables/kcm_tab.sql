-- dbo.kcm_tab  (16 rows)
CREATE TABLE dbo.kcm_tab (
  idnkcm_kcm           int NOT NULL,
  adddte_kcm           datetime NOT NULL,
  addnme_kcm           char(10) NOT NULL,
  idnkck_kcm           int NOT NULL,
  idnkcj_kcm           int NOT NULL,
  kcjseq_kcm           int NOT NULL,
  my_seq_kcm           int NOT NULL,
  mypick_kcm           char(1) NOT NULL,
  my_unc_kcm           numeric(13,5) NOT NULL,
  myunit_kcm           char(16) NOT NULL,
  itotal_kcm           numeric(13,2) NOT NULL,
  pcitem_kcm           numeric(7,2) NOT NULL,
  my_xml_kcm           text(2147483647) NOT NULL,
  PRIMARY KEY (idnkcm_kcm)
);