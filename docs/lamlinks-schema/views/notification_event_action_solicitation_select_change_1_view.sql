-- dbo.notification_event_action_solicitation_select_change_1_view



/* view notification_event_action_solicitation_select_change_1_view: add view */


/* view notification_event_action_solicitation_select_change_1_view: add view */


/* view notification_event_action_solicitation_select_change_1_view: add view */

/* view notification_event_action_solicitation_select_change_1_view: add view */


/* view notification_event_action_solicitation_select_change_1_view: add view */


/* view notification_event_action_solicitation_select_change_1_view: add view */
CREATE VIEW [dbo].[notification_event_action_solicitation_select_change_1_view]
AS
SELECT DISTINCT 
                         dbo.sol_abs_0_query.sol_no_k10, dbo.sol_abs_0_query.idnkc4_kc4, dbo.notification_event_action_1_view.idnkcc_kcc, dbo.notification_event_action_1_view.catitl_kap, dbo.sol_abs_0_query.checkd_k11
FROM            dbo.notification_event_action_1_view INNER JOIN
                         dbo.sol_abs_0_query ON dbo.notification_event_action_1_view.idnsrc_kcc = dbo.sol_abs_0_query.idnkc4_kc4
WHERE        (dbo.notification_event_action_1_view.srctbl_kcc = 'kc4') AND (dbo.notification_event_action_1_view.catitl_kap = 'Solicitation Select Change')






