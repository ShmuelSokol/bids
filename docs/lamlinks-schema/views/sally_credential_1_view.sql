-- dbo.sally_credential_1_view



/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */

/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */


/* view sally_credential_1_view: add view */
/* view sally_credential_1_view: add view 
 view sally_credential_1_view: add view 
 view sally_credential_1_view: add view */
CREATE VIEW [dbo].[sally_credential_1_view]
AS
SELECT        dbo.k14_tab.u_name_k14, dbo.kah_tab.a_note_kah, dbo.k14_tab.idnk14_k14, dbo.kah_tab.idnkah_kah, dbo.kah_tab.anutyp_kah
FROM            dbo.k14_tab INNER JOIN
                         dbo.kah_tab ON dbo.k14_tab.idnk14_k14 = dbo.kah_tab.idnanu_kah AND dbo.kah_tab.anutyp_kah = 'Sally Credentials ' AND dbo.kah_tab.anutbl_kah = 'k14'















