-- dbo.notification_event_trip_1_view



/* view notification_event_trip_1_view: add view */


/* view notification_event_trip_1_view: add view */


/* view notification_event_trip_1_view: add view */

/* view notification_event_trip_1_view: add view */


/* view notification_event_trip_1_view: add view */


/* view notification_event_trip_1_view: add view */
CREATE VIEW [dbo].[notification_event_trip_1_view]
AS
SELECT        dbo.kcb_tab.n_when_kcb, dbo.kcd_tab.n_stat_kcd, dbo.kcd_tab.n_time_kcd, dbo.kcb_tab.idnkcb_kcb, dbo.kcd_tab.idnkcd_kcd
FROM            dbo.kcd_tab INNER JOIN
                         dbo.kcb_tab ON dbo.kcd_tab.idnkcb_kcd = dbo.kcb_tab.idnkcb_kcb






