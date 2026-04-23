-- dbo.kdy_tab  (59 rows)
CREATE TABLE dbo.kdy_tab (
  idnkdy_kdy           int NOT NULL,
  adtime_kdy           datetime NOT NULL,
  uptime_kdy           datetime NOT NULL,
  idnnam_kdy           varchar(32) NOT NULL,
  idnval_kdy           int NOT NULL,
  tabnam_kdy           varchar(32) NOT NULL,
  PRIMARY KEY (idnkdy_kdy)
);