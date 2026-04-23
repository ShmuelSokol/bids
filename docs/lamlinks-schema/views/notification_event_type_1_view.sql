-- dbo.notification_event_type_1_view



/* view notification_event_type_1_view: add view */


/* view notification_event_type_1_view: add view */


/* view notification_event_type_1_view: add view */

/* view notification_event_type_1_view: add view */


/* view notification_event_type_1_view: add view */


/* view notification_event_type_1_view: add view */
/* view notification_event_type_1_view: add view */
CREATE VIEW [dbo].[notification_event_type_1_view]
AS
SELECT        dbo.kcb_tab.narnam_kcb, dbo.kcb_tab.n_when_kcb, dbo.kcb_tab.ok2use_kcb, dbo.general_category_1_view.catype_kap, dbo.general_category_1_view.catitl_kap, dbo.kcb_tab.idnkcb_kcb, 
                         dbo.general_category_1_view.idnkap_kap
FROM            dbo.kcb_tab INNER JOIN
                         dbo.general_category_1_view ON dbo.kcb_tab.netkap_kcb = dbo.general_category_1_view.idnkap_kap






