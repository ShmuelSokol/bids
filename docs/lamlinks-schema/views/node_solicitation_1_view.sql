-- dbo.node_solicitation_1_view



/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */

/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */


/* view node_solicitation_1_view: add view */
CREATE VIEW [dbo].[node_solicitation_1_view]
AS
SELECT DISTINCT dbo.kan_tab.nodnam_kan, dbo.kan_tab.soncnt_kan, dbo.k08_tab.idnk08_k08, dbo.kan_tab.idnkan_kan, dbo.kan_tab.tpltbl_kan, dbo.kan_tab.idntpl_kan
FROM         dbo.k08_tab INNER JOIN
                      dbo.kc4_tab ON dbo.k08_tab.idnk08_k08 = dbo.kc4_tab.idnk08_kc4 INNER JOIN
                      dbo.kan_tab ON dbo.kc4_tab.idnkc4_kc4 = dbo.kan_tab.idntpl_kan
WHERE     (dbo.kan_tab.tpltbl_kan = 'kc4') AND (NOT (dbo.kan_tab.idntpl_kan = 0))


















