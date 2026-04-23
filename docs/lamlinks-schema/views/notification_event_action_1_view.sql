-- dbo.notification_event_action_1_view



/* view notification_event_action_1_view: add view */


/* view notification_event_action_1_view: add view */


/* view notification_event_action_1_view: add view */

/* view notification_event_action_1_view: add view */


/* view notification_event_action_1_view: add view */


/* view notification_event_action_1_view: add view */
CREATE VIEW [dbo].[notification_event_action_1_view]
AS
SELECT        dbo.notification_event_type_1_view.narnam_kcb, dbo.notification_event_type_1_view.catype_kap, dbo.notification_event_type_1_view.catitl_kap, dbo.kcd_tab.actcnt_kcd, dbo.kcc_tab.idnkcc_kcc, 
                         dbo.kcc_tab.tesk14_kcc, dbo.kcc_tab.srctbl_kcc, dbo.kcc_tab.idnsrc_kcc
FROM            dbo.kcd_tab INNER JOIN
                         dbo.kcc_tab ON dbo.kcd_tab.idnkcc_kcd = dbo.kcc_tab.idnkcc_kcc INNER JOIN
                         dbo.notification_event_type_1_view ON dbo.kcd_tab.idnkcb_kcd = dbo.notification_event_type_1_view.idnkcb_kcb






