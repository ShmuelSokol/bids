-- dbo.kd2_tab  (23 rows)
CREATE TABLE dbo.kd2_tab (
  idnkd2_kd2           int NOT NULL,
  adtime_kd2           datetime NOT NULL,
  uptime_kd2           datetime NOT NULL,
  idnk71_kd2           int NOT NULL,
  bverno_kd2           int NOT NULL,
  bv_num_kd2           varchar(16) NOT NULL,
  bvdesc_kd2           varchar(240) NOT NULL,
  bvstat_kd2           varchar(16) NOT NULL,
  PRIMARY KEY (idnkd2_kd2)
);