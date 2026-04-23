-- dbo.fyi_line_0_query



/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */

/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */


/* view fyi_line_0_query: add view */
CREATE VIEW [dbo].[fyi_line_0_query]
AS
SELECT DISTINCT dbo.k11_tab.idnk11_k11, dbo.k61_tab.idnk61_k61, dbo.k62_tab.fyttrt_k62
FROM         dbo.k67_tab INNER JOIN
                      dbo.k62_tab ON dbo.k67_tab.idnk62_k67 = dbo.k62_tab.idnk62_k62 INNER JOIN
                      dbo.k61_tab ON dbo.k62_tab.idnk61_k62 = dbo.k61_tab.idnk61_k61 INNER JOIN
                      dbo.k11_tab ON dbo.k67_tab.lam_id_k67 = dbo.k11_tab.idnk11_k11


















