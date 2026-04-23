-- dbo.k39_tab  (50 rows)
CREATE TABLE dbo.k39_tab (
  idnk39_k39           int NOT NULL,
  uptime_k39           datetime NOT NULL,
  upname_k39           char(10) NOT NULL,
  idnk12_k39           int NOT NULL,
  idnk36_k39           int NOT NULL,
  s_code_k39           char(16) NOT NULL,
  s_attn_k39           char(40) NOT NULL,
  s_phon_k39           char(20) NOT NULL,
  s_faxn_k39           char(20) NOT NULL,
  s_emal_k39           char(80) NOT NULL,
  rfqsok_k39           char(1) NOT NULL,
  rs_typ_k39           char(16) NOT NULL,
  dwgtyp_k39           char(16) NOT NULL,
  review_k39           char(1) NOT NULL,
  fobzip_k39           char(40) NOT NULL,
  r_note_k39           text(2147483647) NOT NULL,
  PRIMARY KEY (idnk39_k39)
);