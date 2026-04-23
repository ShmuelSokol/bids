-- dbo.sol_part_0_query



/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */

/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */


/* view sol_part_0_query: add view */
CREATE VIEW [dbo].[sol_part_0_query]
AS
SELECT     dbo.k08_tab.idnk08_k08, dbo.kcg_tab.idnk09_kcg AS idnk09_k09, dbo.k10_tab.idnk10_k10, dbo.k11_tab.idnk11_k11, dbo.kc4_tab.idnkc4_kc4, 
                      dbo.kcg_tab.idnkcg_kcg
FROM         dbo.k10_tab INNER JOIN
                      dbo.kc4_tab INNER JOIN
                      dbo.k08_tab ON dbo.kc4_tab.idnk08_kc4 = dbo.k08_tab.idnk08_k08 ON dbo.k10_tab.idnk10_k10 = dbo.kc4_tab.idnk10_kc4 INNER JOIN
                      dbo.kcg_tab ON dbo.kc4_tab.idnkc4_kc4 = dbo.kcg_tab.idnkc4_kcg INNER JOIN
                      dbo.k11_tab ON dbo.k10_tab.idnk10_k10 = dbo.k11_tab.idnk10_k11 AND dbo.k08_tab.idnk08_k08 = dbo.k11_tab.idnk08_k11 AND 
                      dbo.kcg_tab.idnk09_kcg = dbo.k11_tab.idnk09_k11


















