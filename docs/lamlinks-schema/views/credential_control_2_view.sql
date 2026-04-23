-- dbo.credential_control_2_view



/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */

/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */


/* view credential_control_2_view: add view */
/* view credential_control_2_view: add view 
 view credential_control_2_view: add view 
 view credential_control_2_view: add view */
CREATE VIEW [dbo].[credential_control_2_view]
AS
SELECT        dbo.credential_control_1_view.toanam_kdg, dbo.demographics_1_view.d_attn_ka7, dbo.demographics_1_view.d_emal_ka7, dbo.credential_control_1_view.athsys_kdf, dbo.credential_control_1_view.athtyp_kdf, 
                         dbo.credential_control_1_view.c_stat_kdg, dbo.credential_control_1_view.c_text_kdg, dbo.credential_control_1_view.efftme_kdg, dbo.credential_control_1_view.lifcyc_kdf, 
                         dbo.credential_control_1_view.ttl_ms_kdf, dbo.credential_control_1_view.redohh_kdf, dbo.credential_control_1_view.idnkdf_kdf, dbo.credential_control_1_view.idnkdg_kdg, 
                         dbo.credential_control_1_view.tbltoa_kdg, dbo.credential_control_1_view.idntoa_kdg, dbo.credential_control_1_view.athxml_kdg, dbo.demographics_1_view.e_code_k12 AS e_code_toa, 
                         dbo.demographics_1_view.e_name_k12 AS e_name_toa
FROM            dbo.credential_control_1_view LEFT OUTER JOIN
                         dbo.demographics_1_view ON dbo.credential_control_1_view.idntoa_kdg = dbo.demographics_1_view.idnka7_ka7 AND dbo.credential_control_1_view.tbltoa_kdg = 'ka7'
WHERE        (dbo.credential_control_1_view.tbltoa_kdg = 'ka7')















