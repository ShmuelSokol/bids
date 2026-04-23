-- dbo.kbd_tab  (33 rows)
CREATE TABLE dbo.kbd_tab (
  idnkbd_kbd           int NOT NULL,
  adddte_kbd           datetime NOT NULL,
  catset_kbd           char(80) NOT NULL,
  catype_kbd           char(80) NOT NULL,
  catutp_kbd           char(32) NOT NULL,
  caudes_kbd           varchar(240) NOT NULL,
  kbdadd_kbd           char(1) NOT NULL,
  kapadd_kbd           char(1) NOT NULL,
  PRIMARY KEY (idnkbd_kbd)
);