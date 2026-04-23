-- dbo.k27_tab  (12 rows)
CREATE TABLE dbo.k27_tab (
  idnk27_k27           int NOT NULL,
  uptime_k27           datetime NOT NULL,
  upname_k27           char(10) NOT NULL,
  ssanam_k27           char(32) NOT NULL,
  ssades_k27           char(80) NOT NULL,
  ssafin_k27           char(3) NOT NULL,
  ssafok_k27           char(3) NOT NULL,
  ssaclr_k27           char(16) NOT NULL,
  ssatyp_k27           char(16) NOT NULL,
  ssasys_k27           char(3) NOT NULL,
  idnk23_k27           int NOT NULL,
  PRIMARY KEY (idnk27_k27)
);