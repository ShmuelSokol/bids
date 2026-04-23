-- dbo.dates_profiles  (3237 rows)
CREATE TABLE dbo.dates_profiles (
  invcdat              datetime NOT NULL,
  profile              varchar(50) NOT NULL,
  PRIMARY KEY (invcdat, profile)
);