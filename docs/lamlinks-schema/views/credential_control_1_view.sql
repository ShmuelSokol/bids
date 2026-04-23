-- dbo.credential_control_1_view



/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */

/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */


/* view credential_control_1_view: add view */
/* view credential_control_1_view: add view 
 view credential_control_1_view: add view 
 view credential_control_1_view: add view */
CREATE VIEW [dbo].[credential_control_1_view]
AS
SELECT        dbo.kdg_tab.toanam_kdg, dbo.kdf_tab.athsys_kdf, dbo.kdf_tab.athtyp_kdf, dbo.kdg_tab.c_stat_kdg, dbo.kdg_tab.c_text_kdg, dbo.kdg_tab.efftme_kdg, dbo.kdf_tab.lifcyc_kdf, dbo.kdf_tab.ttl_ms_kdf, 
                         dbo.kdf_tab.redohh_kdf, dbo.kdf_tab.idnkdf_kdf, dbo.kdg_tab.idnkdg_kdg, dbo.kdg_tab.tbltoa_kdg, dbo.kdg_tab.idntoa_kdg, dbo.kdg_tab.athxml_kdg
FROM            dbo.kdf_tab INNER JOIN
                         dbo.kdg_tab ON dbo.kdf_tab.idnkdf_kdf = dbo.kdg_tab.idnkdf_kdg















