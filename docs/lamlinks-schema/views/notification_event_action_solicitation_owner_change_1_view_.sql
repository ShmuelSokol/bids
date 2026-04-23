-- dbo.notification_event_action_solicitation_owner_change_1_view 



/* view notification_event_action_solicitation_owner_change_1_view: add view */


/* view notification_event_action_solicitation_owner_change_1_view: add view */


/* view notification_event_action_solicitation_owner_change_1_view: add view */

/* view notification_event_action_solicitation_owner_change_1_view: add view */


/* view notification_event_action_solicitation_owner_change_1_view: add view */
/* view notification_event_action_solicitation_owner_change_1_view: add view */
CREATE VIEW dbo.[notification_event_action_solicitation_owner_change_1_view ]
AS
SELECT DISTINCT 
                         dbo.sol_abs_0_query.sol_no_k10, dbo.sol_abs_0_query.checkd_k11, ISNULL(dbo.login_user_1_view.e_name_k12, '') AS e_name_own, ISNULL(dbo.login_user_1_view.e_emal_k12, '') AS e_emal_own, 
                         dbo.sol_abs_0_query.idnkc4_kc4, dbo.notification_event_action_1_view.idnkcc_kcc, dbo.notification_event_action_1_view.catitl_kap, ISNULL(dbo.login_user_1_view.idnk14_k14, 0) AS idnk14_own, 
                         dbo.sol_abs_0_query.idnk10_k10
FROM            dbo.notification_event_action_1_view INNER JOIN
                         dbo.sol_abs_0_query ON dbo.notification_event_action_1_view.idnsrc_kcc = dbo.sol_abs_0_query.idnkc4_kc4 LEFT OUTER JOIN
                         dbo.login_user_1_view ON dbo.sol_abs_0_query.k14own_kc4 = dbo.login_user_1_view.idnk14_k14
WHERE        (dbo.notification_event_action_1_view.srctbl_kcc = 'kc4') AND (dbo.notification_event_action_1_view.catitl_kap = 'Solicitation owner change')





