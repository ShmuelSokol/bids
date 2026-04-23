-- dbo.kdn_tab  (0 rows)
CREATE TABLE dbo.kdn_tab (
  idnkdn_kdn           int NOT NULL,
  adtime_kdn           datetime NOT NULL,
  idnkdm_kdn           int NOT NULL,
  s_time_kdn           datetime NOT NULL,
  e_time_kdn           datetime NOT NULL,
  t_comp_kdn           varchar(16) NOT NULL,
  t_text_kdn           varchar(240) NOT NULL,
  PRIMARY KEY (idnkdn_kdn)
);