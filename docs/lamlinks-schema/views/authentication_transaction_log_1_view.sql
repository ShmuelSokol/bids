-- dbo.authentication_transaction_log_1_view



/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */

/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */


/* view authentication_transaction_log_1_view: add view */
CREATE VIEW [dbo].[authentication_transaction_log_1_view]
AS
SELECT        dbo.k14_tab.u_name_k14 AS u_name_rqr, dbo.kde_tab.t_type_kde, dbo.kde_tab.adtime_kde, dbo.kde_tab.toanam_kde, dbo.credential_control_1_view.toanam_kdg, dbo.kde_tab.a_comp_kde, 
                         dbo.credential_control_1_view.c_stat_kdg, dbo.credential_control_1_view.athsys_kdf, dbo.credential_control_1_view.athtyp_kdf, dbo.credential_control_1_view.efftme_kdg, dbo.kde_tab.k14rqr_kde, 
                         dbo.kde_tab.idnkde_kde, dbo.credential_control_1_view.idnkdf_kdf, dbo.credential_control_1_view.idnkdg_kdg
FROM            dbo.k14_tab INNER JOIN
                         dbo.kde_tab ON dbo.k14_tab.idnk14_k14 = dbo.kde_tab.k14rqr_kde INNER JOIN
                         dbo.credential_control_1_view ON dbo.kde_tab.idnkdg_kde = dbo.credential_control_1_view.idnkdg_kdg


















