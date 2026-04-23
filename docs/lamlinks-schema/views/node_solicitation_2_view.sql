-- dbo.node_solicitation_2_view



/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */

/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */


/* view node_solicitation_2_view: add view */
CREATE VIEW [dbo].[node_solicitation_2_view]
AS
SELECT DISTINCT dbo.kan_tab.nodnam_kan, dbo.kan_tab.soncnt_kan, dbo.k40_tab.idnk08_k40 AS idnk08_k08, dbo.kan_tab.idnkan_kan
FROM         dbo.k40_tab INNER JOIN
                      dbo.k43_tab ON dbo.k40_tab.idnk40_k40 = dbo.k43_tab.idnk40_k43 INNER JOIN
                      dbo.kcl_tab INNER JOIN
                      dbo.kan_tab ON dbo.kcl_tab.idnkan_kcl = dbo.kan_tab.idnkan_kan ON dbo.k43_tab.idnk43_k43 = dbo.kcl_tab.idnsnx_kcl
WHERE     (dbo.kcl_tab.tblsnx_kcl = 'k43') AND (NOT (dbo.kcl_tab.idnsnx_kcl = 0))


















