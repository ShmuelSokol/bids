-- dbo.bom_project_view_2



/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */

/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */


/* view bom_project_view_2: add view */
CREATE VIEW [dbo].[bom_project_view_2]
AS
SELECT     dbo.bom_project_view_1.prjnam_k73, dbo.sol_abs_0_query.sol_no_k10, dbo.bom_project_view_1.prtnum_k71, dbo.bom_project_view_1.p_desc_k71, 
                      dbo.bom_project_view_1.fsc_k08, dbo.bom_project_view_1.niin_k08, dbo.bom_project_view_1.bv_num_kd2, dbo.bom_project_view_1.bvstat_kd2, 
                      dbo.bom_project_view_1.cage_k13 AS e_code_mfg, dbo.sol_abs_0_query.idnk11_k11, dbo.bom_project_view_1.idnk71_k71, dbo.bom_project_view_1.idnk73_k73, 
                      dbo.bom_project_view_1.addtme_k73, dbo.sol_abs_0_query.idnk12_k13
FROM         dbo.bom_project_view_1 LEFT OUTER JOIN
                      dbo.sol_abs_0_query ON dbo.bom_project_view_1.idnk11_k73 = dbo.sol_abs_0_query.idnk11_k11


















