-- dbo.k12_tab  (76168 rows)
CREATE TABLE dbo.k12_tab (
  idnk12_k12           int NOT NULL,
  uptime_k12           datetime NOT NULL,
  upname_k12           char(10) NOT NULL,
  e_code_k12           char(16) NOT NULL,
  e_name_k12           char(40) NOT NULL,
  e_fnam_k12           char(40) NOT NULL,
  e_phon_k12           char(20) NOT NULL,
  e_faxn_k12           char(20) NOT NULL,
  e_attn_k12           char(40) NOT NULL,
  e_emal_k12           char(80) NOT NULL,
  e_madr_k12           text(2147483647) NOT NULL,
  e_note_k12           text(2147483647) NOT NULL,
  homurl_k12           varchar(200),
  e_desc_k12           varchar(200),
  PRIMARY KEY (idnk12_k12)
);