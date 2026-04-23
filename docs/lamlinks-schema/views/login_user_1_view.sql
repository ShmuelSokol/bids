-- dbo.login_user_1_view



/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */

/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */


/* view login_user_1_view: add view */
/* view login_user_1_view: add view 
 view login_user_1_view: add view 
 view login_user_1_view: add view */
CREATE VIEW [dbo].[login_user_1_view]
AS
SELECT        dbo.k14_tab.u_name_k14, dbo.k14_tab.u_pass_k14, dbo.k14_tab.u_menu_k14, dbo.k12_tab.e_code_k12, dbo.k14_tab.idnk14_k14, dbo.k12_tab.idnk12_k12, dbo.k12_tab.e_name_k12, dbo.k12_tab.e_phon_k12, 
                         dbo.k12_tab.e_faxn_k12, dbo.k12_tab.e_emal_k12, dbo.sally_credential_1_view.a_note_kah
FROM            dbo.k14_tab INNER JOIN
                         dbo.k12_tab ON dbo.k14_tab.idnk12_k14 = dbo.k12_tab.idnk12_k12 LEFT OUTER JOIN
                         dbo.sally_credential_1_view ON dbo.k14_tab.idnk14_k14 = dbo.sally_credential_1_view.idnk14_k14















